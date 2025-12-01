import { useEffect, useRef, useCallback, useState } from 'react'
import L from 'leaflet'
import 'leaflet-draw'
import MapControls from './MapControls'
import { MAP_CONFIG, createFeatureFromLayer, formatCoordinates, calculateScaleText } from '../../utils/mapUtils'
import type { MapContainerProps, FeatureType, AOIFeature } from '../../types'

// Fix for default marker icons in Leaflet with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

// Type definitions for Leaflet Draw
interface DrawCreatedEvent {
  layer: L.Layer
  layerType: string
}

type DrawHandler = {
  enable: () => void
  disable: () => void
}

export default function MapContainer({
  appState,
  onMapReady,
  onFeatureAdd,
  onToolComplete,
  showToast
}: MapContainerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const wmsLayerRef = useRef<L.TileLayer | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const currentDrawHandlerRef = useRef<DrawHandler | null>(null)
  
  const [coordinates, setCoordinates] = useState(formatCoordinates(MAP_CONFIG.DEFAULT_CENTER[0], MAP_CONFIG.DEFAULT_CENTER[1]))
  const [zoomLevel, setZoomLevel] = useState(MAP_CONFIG.DEFAULT_ZOOM)
  const [scaleText, setScaleText] = useState('100 km')

  const createPopupContent = useCallback((feature: AOIFeature) => {
    const formatAreaValue = (area?: number) => {
      if (!area) return ''
      if (area < 10000) return `${area.toFixed(0)} m²`
      if (area < 1000000) return `${(area / 10000).toFixed(2)} ha`
      return `${(area / 1000000).toFixed(2)} km²`
    }

    return `
      <div class="text-slate-900">
        <h4 class="font-semibold">${feature.name}</h4>
        <p class="text-sm text-slate-600">${feature.type}</p>
        ${feature.area ? `<p class="text-sm">Area: ${formatAreaValue(feature.area)}</p>` : ''}
      </div>
    `
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Create map centered on India
    const map = L.map(mapContainerRef.current, {
      center: MAP_CONFIG.DEFAULT_CENTER,
      zoom: MAP_CONFIG.DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      minZoom: MAP_CONFIG.MIN_ZOOM,
      maxZoom: MAP_CONFIG.MAX_ZOOM
    })

    // Add OpenStreetMap base layer
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: MAP_CONFIG.MAX_ZOOM
    }).addTo(map)

    // Initialize drawn items layer
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    // Store refs
    mapRef.current = map
    wmsLayerRef.current = osmLayer
    drawnItemsRef.current = drawnItems

    // Event handlers
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCoordinates(formatCoordinates(e.latlng.lat, e.latlng.lng))
    })

    map.on('zoomend', () => {
      const zoom = map.getZoom()
      setZoomLevel(zoom)
      setScaleText(calculateScaleText(zoom, map.getCenter().lat))
    })

    // Initial scale
    setScaleText(calculateScaleText(map.getZoom(), map.getCenter().lat))

    // Handle draw created
    map.on(L.Draw.Event.CREATED, (e: L.LeafletEvent) => {
      const event = e as unknown as DrawCreatedEvent
      const layer = event.layer
      const type = event.layerType as FeatureType

      const feature = createFeatureFromLayer(
        layer,
        type,
        `AOI ${appState.features.length + 1}`,
        appState.features.length
      )

      // Add layer to drawn items
      ;(layer as L.Layer & { featureId?: string }).featureId = feature.id
      
      if ('bindPopup' in layer) {
        (layer as L.Layer & { bindPopup: (content: string) => void }).bindPopup(createPopupContent(feature))
      }
      
      drawnItems.addLayer(layer)

      onFeatureAdd(feature)
      onToolComplete()
    })

    map.on(L.Draw.Event.DRAWSTOP, () => {
      onToolComplete()
    })

    // Notify parent
    onMapReady(map)
    showToast('Map loaded - Centered on India', 'success')

    return () => {
      map.remove()
      mapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Restore features from storage
  useEffect(() => {
    if (!drawnItemsRef.current || !mapRef.current) return

    // Clear existing layers
    drawnItemsRef.current.clearLayers()

    // Add features from state
    appState.features.forEach((feature: AOIFeature) => {
      let layer: L.Layer | null = null

      switch (feature.type) {
        case 'polygon':
          layer = L.polygon(feature.coordinates as [number, number][], {
            color: feature.color,
            fillOpacity: 0.3
          })
          break
        case 'rectangle':
          layer = L.rectangle(feature.coordinates as [number, number][], {
            color: feature.color,
            fillOpacity: 0.3
          })
          break
        case 'circle': {
          const coords = feature.coordinates as { center: number[]; radius: number }
          layer = L.circle([coords.center[0], coords.center[1]], {
            radius: coords.radius,
            color: feature.color,
            fillOpacity: 0.3
          })
          break
        }
        case 'marker':
          layer = L.marker(feature.coordinates as [number, number])
          break
      }

      if (layer) {
        (layer as L.Layer & { featureId?: string }).featureId = feature.id
        layer.bindPopup(createPopupContent(feature))
        drawnItemsRef.current!.addLayer(layer)
      }
    })
  }, [appState.features, createPopupContent])

  // Handle WMS visibility
  useEffect(() => {
    if (!wmsLayerRef.current || !mapRef.current) return

    if (appState.wmsVisible) {
      if (!mapRef.current.hasLayer(wmsLayerRef.current)) {
        mapRef.current.addLayer(wmsLayerRef.current)
      }
    } else {
      mapRef.current.removeLayer(wmsLayerRef.current)
    }
  }, [appState.wmsVisible])

  // Handle AOI visibility
  useEffect(() => {
    if (!drawnItemsRef.current || !mapRef.current) return

    if (appState.aoiVisible) {
      if (!mapRef.current.hasLayer(drawnItemsRef.current)) {
        mapRef.current.addLayer(drawnItemsRef.current)
      }
    } else {
      mapRef.current.removeLayer(drawnItemsRef.current)
    }
  }, [appState.aoiVisible])

  // Handle WMS opacity
  useEffect(() => {
    if (wmsLayerRef.current) {
      wmsLayerRef.current.setOpacity(appState.wmsOpacity / 100)
    }
  }, [appState.wmsOpacity])

  // Handle active drawing tool
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Cancel any existing draw handler
    if (currentDrawHandlerRef.current) {
      currentDrawHandlerRef.current.disable()
      currentDrawHandlerRef.current = null
    }

    if (!appState.activeTool) return

    const shapeOptions = {
      color: '#3b82f6',
      fillOpacity: 0.3
    }

    let handler: DrawHandler | null = null

    const mapAny = map as unknown as L.DrawMap

    switch (appState.activeTool) {
      case 'polygon':
        handler = new L.Draw.Polygon(mapAny, { shapeOptions }) as unknown as DrawHandler
        break
      case 'rectangle':
        handler = new L.Draw.Rectangle(mapAny, { shapeOptions }) as unknown as DrawHandler
        break
      case 'circle':
        handler = new L.Draw.Circle(mapAny, { shapeOptions }) as unknown as DrawHandler
        break
      case 'marker':
        handler = new L.Draw.Marker(mapAny, {}) as unknown as DrawHandler
        break
    }

    if (handler) {
      handler.enable()
      currentDrawHandlerRef.current = handler
    }
  }, [appState.activeTool])

  return (
    <main className="flex-1 relative">
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0"
        data-testid="map-container"
      />

      {/* Custom Map Controls */}
      <MapControls mapRef={mapRef.current} showToast={showToast} />

      {/* Scale Bar */}
      <div className="absolute bottom-4 left-4 bg-slate-800/90 px-3 py-2 rounded-lg border border-slate-700 z-[1000]">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <div className="w-20 h-1 bg-white border-l-2 border-r-2 border-white" />
          <span data-testid="scale-text">{scaleText}</span>
        </div>
      </div>

      {/* Drawing Mode Indicator */}
      {appState.activeTool && (
        <div className="absolute top-4 left-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-[1000] fade-in">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span data-testid="drawing-indicator">
              Drawing {appState.activeTool} - Click to add points
            </span>
          </div>
        </div>
      )}

      {/* Coordinates Display */}
      <div className="absolute bottom-4 right-4 bg-slate-800/90 px-3 py-2 rounded-lg border border-slate-700 z-[1000]">
        <div className="flex flex-col gap-1 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Coordinates</span>
            <span className="font-mono text-slate-300" data-testid="coordinates">{coordinates}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Zoom</span>
            <span className="font-mono text-slate-300" data-testid="zoom-level">{zoomLevel}</span>
          </div>
        </div>
      </div>
    </main>
  )
}