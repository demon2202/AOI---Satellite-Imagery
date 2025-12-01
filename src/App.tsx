import { useState, useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet-draw'
import './index.css'

// Fix Leaflet marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

// Types
interface AOIFeature {
  id: string
  name: string
  type: 'polygon' | 'rectangle' | 'circle' | 'marker'
  coordinates: number[][] | { center: number[]; radius: number } | number[]
  area?: number
  color: string
  createdAt: string
}

interface Notification {
  id: string
  title: string
  message: string
  read: boolean
  timestamp: string
}

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

type ViewType = 'map' | 'analytics' | 'settings'

// Config - INDIA as default
const MAP_CONFIG = {
  DEFAULT_CENTER: [20.5937, 78.9629] as [number, number],
  DEFAULT_ZOOM: 5,
  MIN_ZOOM: 3,
  MAX_ZOOM: 19
}

// Utility functions
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

function formatArea(sqMeters: number): string {
  if (sqMeters < 10000) return `${sqMeters.toFixed(0)} m²`
  if (sqMeters < 1000000) return `${(sqMeters / 10000).toFixed(2)} ha`
  return `${(sqMeters / 1000000).toFixed(2)} km²`
}

function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`
}

function calculatePolygonArea(latlngs: L.LatLng[]): number {
  if (!latlngs || latlngs.length < 3) return 0
  const EARTH_RADIUS = 6378137
  let total = 0
  for (let i = 0; i < latlngs.length; i++) {
    const p1 = latlngs[i]
    const p2 = latlngs[(i + 1) % latlngs.length]
    total += (p2.lng - p1.lng) * Math.PI / 180 *
      (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180))
  }
  return Math.abs(total * EARTH_RADIUS * EARTH_RADIUS / 2)
}

// Main App Component
export default function App() {
  // State
  const [features, setFeatures] = useState<AOIFeature[]>(() => {
    const saved = localStorage.getItem('aoi-features')
    return saved ? JSON.parse(saved) : []
  })
  const [activeView, setActiveView] = useState<ViewType>('map')
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [wmsVisible, setWmsVisible] = useState(true)
  const [aoiVisible, setAoiVisible] = useState(true)
  const [wmsOpacity, setWmsOpacity] = useState(100)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('notifications')
    return saved ? JSON.parse(saved) : [
      { id: '1', title: 'Welcome!', message: 'Start by drawing an AOI on the map.', read: false, timestamp: new Date().toISOString() },
      { id: '2', title: 'Tip', message: 'Use the search bar to find locations quickly.', read: false, timestamp: new Date().toISOString() },
    ]
  })

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const drawHandlerRef = useRef<unknown>(null)

  // Map state
  const [coordinates, setCoordinates] = useState(formatCoordinates(MAP_CONFIG.DEFAULT_CENTER[0], MAP_CONFIG.DEFAULT_CENTER[1]))
  const [zoomLevel, setZoomLevel] = useState(MAP_CONFIG.DEFAULT_ZOOM)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ place_id: number; lat: string; lon: string; display_name: string }>>([])
  const [showSearchResults, setShowSearchResults] = useState(false)

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('aoi-features', JSON.stringify(features))
  }, [features])

  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications))
  }, [notifications])

  // Toast helper
  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = generateId()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || activeView !== 'map') return

    const map = L.map(mapContainerRef.current, {
      center: MAP_CONFIG.DEFAULT_CENTER,
      zoom: MAP_CONFIG.DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      minZoom: MAP_CONFIG.MIN_ZOOM,
      maxZoom: MAP_CONFIG.MAX_ZOOM
    })

    // OpenStreetMap base layer
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: MAP_CONFIG.MAX_ZOOM
    }).addTo(map)

    // Drawn items layer
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    mapRef.current = map
    tileLayerRef.current = tileLayer
    drawnItemsRef.current = drawnItems

    // Event handlers
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCoordinates(formatCoordinates(e.latlng.lat, e.latlng.lng))
    })

    map.on('zoomend', () => {
      setZoomLevel(map.getZoom())
    })

    // Draw created event
    map.on('draw:created', (e: L.LeafletEvent) => {
      const event = e as L.DrawEvents.Created
      const layer = event.layer
      const type = event.layerType as 'polygon' | 'rectangle' | 'circle' | 'marker'

      let coords: AOIFeature['coordinates']
      let area = 0

      if (type === 'polygon' || type === 'rectangle') {
        const latlngs = (layer as L.Polygon).getLatLngs()[0] as L.LatLng[]
        coords = latlngs.map(ll => [ll.lat, ll.lng])
        area = calculatePolygonArea(latlngs)
      } else if (type === 'circle') {
        const circle = layer as L.Circle
        coords = { center: [circle.getLatLng().lat, circle.getLatLng().lng], radius: circle.getRadius() }
        area = Math.PI * circle.getRadius() * circle.getRadius()
      } else {
        const marker = layer as L.Marker
        coords = [marker.getLatLng().lat, marker.getLatLng().lng]
      }

      const colors: Record<string, string> = {
        polygon: '#3b82f6',
        rectangle: '#10b981',
        circle: '#8b5cf6',
        marker: '#ef4444'
      }

      const feature: AOIFeature = {
        id: generateId(),
        name: `AOI ${features.length + 1}`,
        type,
        coordinates: coords,
        area: area > 0 ? area : undefined,
        color: colors[type],
        createdAt: new Date().toISOString()
      }

      drawnItems.addLayer(layer)
      setFeatures(prev => [...prev, feature])
      setActiveTool(null)
      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} created successfully`, 'success')

      // Add notification
      setNotifications(prev => [{
        id: generateId(),
        title: 'New AOI Created',
        message: `${feature.name} has been added to the map.`,
        read: false,
        timestamp: new Date().toISOString()
      }, ...prev])
    })

    map.on('draw:drawstop', () => {
      setActiveTool(null)
    })

    showToast('Map loaded - Centered on India', 'success')

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [activeView, features.length, showToast])

  // Restore features on map
  useEffect(() => {
    if (!drawnItemsRef.current || !mapRef.current) return

    drawnItemsRef.current.clearLayers()

    features.forEach(feature => {
      let layer: L.Layer | null = null

      if (feature.type === 'polygon') {
        layer = L.polygon(feature.coordinates as [number, number][], { color: feature.color, fillOpacity: 0.3 })
      } else if (feature.type === 'rectangle') {
        layer = L.rectangle(feature.coordinates as [number, number][], { color: feature.color, fillOpacity: 0.3 })
      } else if (feature.type === 'circle') {
        const c = feature.coordinates as { center: number[]; radius: number }
        layer = L.circle([c.center[0], c.center[1]], { radius: c.radius, color: feature.color, fillOpacity: 0.3 })
      } else if (feature.type === 'marker') {
        layer = L.marker(feature.coordinates as [number, number])
      }

      if (layer) drawnItemsRef.current!.addLayer(layer)
    })
  }, [features])

  // Handle layer visibility
  useEffect(() => {
    if (!tileLayerRef.current || !mapRef.current) return
    if (wmsVisible) {
      if (!mapRef.current.hasLayer(tileLayerRef.current)) mapRef.current.addLayer(tileLayerRef.current)
    } else {
      mapRef.current.removeLayer(tileLayerRef.current)
    }
  }, [wmsVisible])

  useEffect(() => {
    if (!drawnItemsRef.current || !mapRef.current) return
    if (aoiVisible) {
      if (!mapRef.current.hasLayer(drawnItemsRef.current)) mapRef.current.addLayer(drawnItemsRef.current)
    } else {
      mapRef.current.removeLayer(drawnItemsRef.current)
    }
  }, [aoiVisible])

  useEffect(() => {
    if (tileLayerRef.current) tileLayerRef.current.setOpacity(wmsOpacity / 100)
  }, [wmsOpacity])

  // Handle drawing tool activation
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (drawHandlerRef.current) {
      (drawHandlerRef.current as { disable: () => void }).disable()
      drawHandlerRef.current = null
    }

    if (!activeTool) return

    const shapeOptions = { color: '#3b82f6', fillOpacity: 0.3 }
    let handler: unknown = null

    switch (activeTool) {
      case 'polygon':
        handler = new L.Draw.Polygon(map as L.DrawMap, { shapeOptions })
        break
      case 'rectangle':
        handler = new L.Draw.Rectangle(map as L.DrawMap, { shapeOptions })
        break
      case 'circle':
        handler = new L.Draw.Circle(map as L.DrawMap, { shapeOptions })
        break
      case 'marker':
        handler = new L.Draw.Marker(map as L.DrawMap, {})
        break
    }

    if (handler) {
      (handler as { enable: () => void }).enable()
      drawHandlerRef.current = handler
    }
  }, [activeTool])

  // Search handler
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([])
      setShowSearchResults(false)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`)
        const data = await res.json()
        setSearchResults(data)
        setShowSearchResults(data.length > 0)
      } catch {
        setSearchResults([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Map control handlers
  const handleZoomIn = () => mapRef.current?.zoomIn()
  const handleZoomOut = () => mapRef.current?.zoomOut()
  const handleResetView = () => mapRef.current?.setView(MAP_CONFIG.DEFAULT_CENTER, MAP_CONFIG.DEFAULT_ZOOM)
  const handleLocate = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 15)
        showToast('Location found', 'success')
      },
      () => showToast('Could not get location', 'error')
    )
  }

  const handleSearchSelect = (result: { lat: string; lon: string; display_name: string }) => {
    mapRef.current?.setView([parseFloat(result.lat), parseFloat(result.lon)], 14)
    setSearchQuery(result.display_name.split(',')[0])
    setShowSearchResults(false)
  }

  // Feature handlers
  const removeFeature = (id: string) => {
    setFeatures(prev => prev.filter(f => f.id !== id))
    showToast('Feature deleted', 'info')
  }

  const zoomToFeature = (feature: AOIFeature) => {
    if (!mapRef.current) return
    if (feature.type === 'marker') {
      const coords = feature.coordinates as number[]
      mapRef.current.setView([coords[0], coords[1]], 15)
    } else if (feature.type === 'circle') {
      const c = feature.coordinates as { center: number[]; radius: number }
      mapRef.current.setView([c.center[0], c.center[1]], 14)
    } else {
      const coords = feature.coordinates as number[][]
      const bounds = L.latLngBounds(coords.map(c => [c[0], c[1]] as [number, number]))
      mapRef.current.fitBounds(bounds, { padding: [50, 50] })
    }
  }

  const exportGeoJSON = () => {
    if (features.length === 0) {
      showToast('No features to export', 'warning')
      return
    }

    const geojson = {
      type: 'FeatureCollection',
      features: features.map(f => ({
        type: 'Feature',
        properties: { id: f.id, name: f.name, type: f.type, area: f.area, createdAt: f.createdAt },
        geometry: f.type === 'marker'
          ? { type: 'Point', coordinates: [(f.coordinates as number[])[1], (f.coordinates as number[])[0]] }
          : { type: 'Polygon', coordinates: [f.type === 'circle'
              ? (() => {
                  const c = f.coordinates as { center: number[]; radius: number }
                  const pts: number[][] = []
                  for (let i = 0; i <= 32; i++) {
                    const angle = (i / 32) * 2 * Math.PI
                    pts.push([
                      c.center[1] + (c.radius / (111320 * Math.cos(c.center[0] * Math.PI / 180))) * Math.sin(angle),
                      c.center[0] + (c.radius / 111320) * Math.cos(angle)
                    ])
                  }
                  return pts
                })()
              : [...(f.coordinates as number[][]).map(c => [c[1], c[0]]), [(f.coordinates as number[][])[0][1], (f.coordinates as number[][])[0][0]]]
            ]
          }
      }))
    }

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'aoi-features.geojson'
    a.click()
    URL.revokeObjectURL(url)
    showToast('GeoJSON exported', 'success')
  }

  const clearAllFeatures = () => {
    if (confirm('Clear all features?')) {
      setFeatures([])
      showToast('All features cleared', 'info')
    }
  }

  // Notification handlers
  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const clearAllNotifications = () => {
    setNotifications([])
    showToast('Notifications cleared', 'info')
  }

  const unreadCount = notifications.filter(n => !n.read).length

  // Calculate analytics
  const totalArea = features.reduce((sum, f) => sum + (f.area || 0), 0)
  const avgArea = features.filter(f => f.area).length > 0 ? totalArea / features.filter(f => f.area).length : 0

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <span className="logo-text">AOI Creation</span>
          </div>

          <div className="divider" />

          <nav className="nav">
            <button className={`nav-btn ${activeView === 'map' ? 'active' : ''}`} onClick={() => setActiveView('map')}>Map View</button>
            <button className={`nav-btn ${activeView === 'analytics' ? 'active' : ''}`} onClick={() => setActiveView('analytics')}>Analytics</button>
            <button className={`nav-btn ${activeView === 'settings' ? 'active' : ''}`} onClick={() => setActiveView('settings')}>Settings</button>
          </nav>
        </div>

        {activeView === 'map' && (
          <div className="search-container">
            <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Search location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
            />
            {showSearchResults && (
              <div className="search-results">
                {searchResults.map(r => (
                  <div key={r.place_id} className="search-result-item" onClick={() => handleSearchSelect(r)}>
                    <div className="search-result-name">{r.display_name.split(',')[0]}</div>
                    <div className="search-result-address">{r.display_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="header-right">
          <button className="icon-btn" onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false) }}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </button>
          <div className="avatar" onClick={() => { setShowProfile(!showProfile); setShowNotifications(false) }}>JD</div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {activeView === 'map' && (
          <>
            {/* Sidebar */}
            <aside className="sidebar">
              {/* Drawing Tools */}
              <div className="sidebar-section">
                <div className="sidebar-title">Drawing Tools</div>
                <div className="tools-grid">
                  {['polygon', 'rectangle', 'circle', 'marker'].map(tool => (
                    <button
                      key={tool}
                      className={`tool-btn ${activeTool === tool ? 'active' : ''}`}
                      onClick={() => setActiveTool(activeTool === tool ? null : tool)}
                    >
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {tool === 'polygon' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>}
                        {tool === 'rectangle' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/>}
                        {tool === 'circle' && <circle cx="12" cy="12" r="9" strokeWidth={2}/>}
                        {tool === 'marker' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>}
                      </svg>
                      <span>{tool.charAt(0).toUpperCase() + tool.slice(1)}</span>
                    </button>
                  ))}
                </div>
                <div className="tools-actions">
                  {activeTool && <button className="btn-secondary" onClick={() => setActiveTool(null)}>Cancel</button>}
                  <button className="btn-danger" onClick={clearAllFeatures}>Clear All</button>
                </div>
              </div>

              {/* Layers */}
              <div className="sidebar-section">
                <div className="sidebar-title">Layers</div>
                <div className="layer-item">
                  <div className="layer-info">
                    <div className="layer-icon base">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945"/>
                      </svg>
                    </div>
                    <div>
                      <div className="layer-name">Base Map</div>
                      <div className="layer-desc">OpenStreetMap</div>
                    </div>
                  </div>
                  <div className={`toggle ${wmsVisible ? 'active' : ''}`} onClick={() => setWmsVisible(!wmsVisible)} />
                </div>
                <div className="layer-item">
                  <div className="layer-info">
                    <div className="layer-icon aoi">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                      </svg>
                    </div>
                    <div>
                      <div className="layer-name">AOI Features</div>
                      <div className="layer-desc">{features.length} feature{features.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div className={`toggle ${aoiVisible ? 'active' : ''}`} onClick={() => setAoiVisible(!aoiVisible)} />
                </div>
                <div className="opacity-control">
                  <div className="opacity-header">
                    <span className="opacity-label">Map Opacity</span>
                    <span className="opacity-value">{wmsOpacity}%</span>
                  </div>
                  <input type="range" className="opacity-slider" min="0" max="100" value={wmsOpacity} onChange={(e) => setWmsOpacity(parseInt(e.target.value))} />
                </div>
              </div>

              {/* AOI List */}
              <div className="aoi-list">
                <div className="aoi-header">
                  <div className="sidebar-title">Areas of Interest</div>
                  <button className="export-btn" onClick={exportGeoJSON}>Export GeoJSON</button>
                </div>
                {features.length === 0 ? (
                  <div className="aoi-empty">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                    </svg>
                    <p>No areas defined yet</p>
                    <small>Use drawing tools to create AOI</small>
                  </div>
                ) : (
                  features.map(f => (
                    <div key={f.id} className="aoi-item">
                      <div className="aoi-item-header">
                        <div className="aoi-item-info">
                          <div className="aoi-item-icon" style={{ backgroundColor: `${f.color}20` }}>
                            <svg fill="none" stroke={f.color} viewBox="0 0 24 24">
                              {f.type === 'polygon' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"/>}
                              {f.type === 'rectangle' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/>}
                              {f.type === 'circle' && <circle cx="12" cy="12" r="9" strokeWidth={2}/>}
                              {f.type === 'marker' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>}
                            </svg>
                          </div>
                          <div>
                            <div className="aoi-item-name">{f.name}</div>
                            <div className="aoi-item-meta">{f.type}{f.area ? ` • ${formatArea(f.area)}` : ''}</div>
                          </div>
                        </div>
                        <div className="aoi-item-actions">
                          <button className="aoi-action-btn" onClick={() => zoomToFeature(f)}>
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
                            </svg>
                          </button>
                          <button className="aoi-action-btn delete" onClick={() => removeFeature(f.id)}>
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>

            {/* Map */}
            <div className="map-wrapper">
              <div ref={mapContainerRef} className="map-container" />

              {/* Map Controls */}
              <div className="map-controls">
                <button className="map-control-btn" onClick={handleZoomIn}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                </button>
                <button className="map-control-btn" onClick={handleZoomOut}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6"/>
                  </svg>
                </button>
                <div className="controls-divider" />
                <button className="map-control-btn" onClick={handleResetView}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                  </svg>
                </button>
                <button className="map-control-btn" onClick={handleLocate}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </button>
              </div>

              {/* Drawing Indicator */}
              {activeTool && (
                <div className="drawing-indicator">
                  <div className="drawing-dot" />
                  <span>Drawing {activeTool} - Click to add points</span>
                </div>
              )}

              {/* Scale Bar */}
              <div className="map-info left">
                <div className="scale-bar">
                  <div className="scale-line" />
                  <span>100 km</span>
                </div>
              </div>

              {/* Coordinates */}
              <div className="map-info right">
                <div className="coords-display">
                  <div className="coords-row">
                    <span className="coords-label">Coordinates</span>
                    <span className="coords-value">{coordinates}</span>
                  </div>
                  <div className="coords-row">
                    <span className="coords-label">Zoom</span>
                    <span className="coords-value">{zoomLevel}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Analytics View */}
        {activeView === 'analytics' && (
          <div className="analytics-view">
            <div className="analytics-container">
              <div className="page-header">
                <h1>Analytics Dashboard</h1>
                <p>Overview of your Areas of Interest</p>
              </div>

              <div className="stats-grid">
                {[
                  { label: 'Total Features', value: features.length, color: 'blue' },
                  { label: 'Polygons', value: features.filter(f => f.type === 'polygon').length, color: 'purple' },
                  { label: 'Rectangles', value: features.filter(f => f.type === 'rectangle').length, color: 'green' },
                  { label: 'Circles', value: features.filter(f => f.type === 'circle').length, color: 'yellow' },
                  { label: 'Markers', value: features.filter(f => f.type === 'marker').length, color: 'red' },
                ].map((stat, i) => (
                  <div key={i} className="stat-card">
                    <div className="stat-header">
                      <div className={`stat-icon ${stat.color}`}>
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                        </svg>
                      </div>
                      <span className="stat-label">{stat.label}</span>
                    </div>
                    <div className="stat-value">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div className="area-cards">
                <div className="area-card">
                  <h3>Total Area Coverage</h3>
                  <div className="area-value blue">{totalArea > 0 ? formatArea(totalArea) : '0 m²'}</div>
                  <p className="area-desc">Combined area of all features</p>
                </div>
                <div className="area-card">
                  <h3>Average Area</h3>
                  <div className="area-value green">{avgArea > 0 ? formatArea(avgArea) : '0 m²'}</div>
                  <p className="area-desc">Average area per feature</p>
                </div>
              </div>

              <div className="recent-features">
                <div className="recent-header">
                  <h3>Recent Features</h3>
                </div>
                <div className="recent-list">
                  {features.length === 0 ? (
                    <div className="aoi-empty" style={{ padding: '40px' }}>
                      <p>No features created yet</p>
                    </div>
                  ) : (
                    features.slice(0, 10).map(f => (
                      <div key={f.id} className="recent-item">
                        <div className="recent-item-info">
                          <div className="recent-dot" style={{ backgroundColor: f.color }} />
                          <div>
                            <div className="recent-item-name">{f.name}</div>
                            <div className="recent-item-type">{f.type}</div>
                          </div>
                        </div>
                        <div className="recent-item-meta">
                          <div className="recent-item-area">{f.area ? formatArea(f.area) : 'N/A'}</div>
                          <div className="recent-item-date">{new Date(f.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings View */}
        {activeView === 'settings' && (
          <div className="settings-view">
            <div className="settings-container">
              <div className="page-header">
                <h1>Settings</h1>
                <p>Manage your application preferences</p>
              </div>

              <div className="settings-section">
                <div className="settings-section-header">
                  <h2>General</h2>
                </div>
                <div className="settings-item">
                  <div className="settings-item-info">
                    <h3>Dark Mode</h3>
                    <p>Use dark theme for the application</p>
                  </div>
                  <div className="toggle active" />
                </div>
                <div className="settings-item">
                  <div className="settings-item-info">
                    <h3>Notifications</h3>
                    <p>Receive in-app notifications</p>
                  </div>
                  <div className="toggle active" />
                </div>
                <div className="settings-item">
                  <div className="settings-item-info">
                    <h3>Auto-save Features</h3>
                    <p>Automatically save features to local storage</p>
                  </div>
                  <div className="toggle active" />
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-header">
                  <h2>Map Preferences</h2>
                </div>
                <div className="settings-item">
                  <div className="settings-item-info">
                    <h3>Default Zoom Level</h3>
                    <p>Initial zoom when map loads</p>
                  </div>
                  <select className="settings-select" defaultValue="5">
                    <option value="3">Zoom 3</option>
                    <option value="5">Zoom 5</option>
                    <option value="8">Zoom 8</option>
                    <option value="10">Zoom 10</option>
                  </select>
                </div>
                <div className="settings-item">
                  <div className="settings-item-info">
                    <h3>Language</h3>
                    <p>Select your preferred language</p>
                  </div>
                  <select className="settings-select" defaultValue="en">
                    <option value="en">English</option>
                    <option value="hi">हिंदी</option>
                    <option value="ta">தமிழ்</option>
                  </select>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-header">
                  <h2>Data Management</h2>
                </div>
                <div className="settings-item">
                  <div className="settings-item-info danger">
                    <h3>Clear All Data</h3>
                    <p>Delete all saved features and settings</p>
                  </div>
                  <button className="btn-danger" onClick={() => {
                    if (confirm('Clear all data?')) {
                      localStorage.clear()
                      window.location.reload()
                    }
                  }}>Clear Data</button>
                </div>
              </div>

              <div className="settings-actions">
                <button className="btn btn-cancel" onClick={() => setActiveView('map')}>Cancel</button>
                <button className="btn btn-primary" onClick={() => showToast('Settings saved', 'success')}>Save Settings</button>
              </div>

              <div className="settings-footer">
                <p>AOI Creation v1.0.0</p>
                <p>Built with React, TypeScript, and Leaflet</p>
              </div>
            </div>
          </div>
        )}

        {/* Notification Panel */}
        {showNotifications && (
          <>
            <div className="panel-backdrop" onClick={() => setShowNotifications(false)} />
            <div className="notification-panel">
              <div className="panel-header">
                <h2>Notifications</h2>
                <div className="panel-header-actions">
                  {notifications.length > 0 && <button className="clear-btn" onClick={clearAllNotifications}>Clear all</button>}
                  <button className="close-btn" onClick={() => setShowNotifications(false)}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <div className="notification-empty">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                    <p>No notifications</p>
                  </div>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`notification-item ${n.read ? '' : 'unread'}`} onClick={() => markNotificationRead(n.id)}>
                      <div className="notification-content">
                        <div className={`notification-dot ${n.read ? 'read' : 'unread'}`} />
                        <div className="notification-text">
                          <div className="notification-header">
                            <span className="notification-title">{n.title}</span>
                            <span className="notification-time">
                              {(() => {
                                const diff = Date.now() - new Date(n.timestamp).getTime()
                                const mins = Math.floor(diff / 60000)
                                if (mins < 1) return 'Just now'
                                if (mins < 60) return `${mins}m ago`
                                const hours = Math.floor(diff / 3600000)
                                if (hours < 24) return `${hours}h ago`
                                return `${Math.floor(diff / 86400000)}d ago`
                              })()}
                            </span>
                          </div>
                          <p className="notification-message">{n.message}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* Profile Menu */}
        {showProfile && (
          <>
            <div className="panel-backdrop" onClick={() => setShowProfile(false)} />
            <div className="profile-menu">
              <div className="profile-header">
                <div className="profile-avatar">JD</div>
                <div className="profile-info">
                  <h3>John Doe</h3>
                  <p>john.doe@example.com</p>
                </div>
              </div>
              <div className="profile-menu-items">
                <button className="profile-menu-item" onClick={() => { showToast('Profile settings coming soon', 'info'); setShowProfile(false) }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                  </svg>
                  My Profile
                </button>
                <button className="profile-menu-item" onClick={() => { showToast('Account settings coming soon', 'info'); setShowProfile(false) }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                  Account Settings
                </button>
                <button className="profile-menu-item" onClick={() => { showToast('Help coming soon', 'info'); setShowProfile(false) }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  Help & Support
                </button>
                <div className="profile-menu-divider" />
                <button className="profile-menu-item logout" onClick={() => { showToast('Logged out', 'success'); setShowProfile(false) }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  Log out
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`} onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {t.type === 'success' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>}
              {t.type === 'error' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>}
              {t.type === 'info' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>}
              {t.type === 'warning' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>}
            </svg>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}