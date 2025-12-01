import type { AOIFeature, FeatureType } from '../types'

// Map configuration constants
export const MAP_CONFIG = {
  DEFAULT_CENTER: [20.5937, 78.9629] as [number, number], // India (center)
  DEFAULT_ZOOM: 5,
  MIN_ZOOM: 3,
  MAX_ZOOM: 19,
  WMS_URL: 'https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms',
  WMS_LAYER: 'india3',
  NOMINATIM_URL: 'https://nominatim.openstreetmap.org',
  // Fallback tile layer (OpenStreetMap)
  OSM_URL: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
}

// Feature colors for different types
export const FEATURE_COLORS: Record<FeatureType, string> = {
  polygon: '#3b82f6',
  rectangle: '#10b981',
  circle: '#8b5cf6',
  marker: '#ef4444'
}

/**
 * Generate a unique ID for features
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * Format area value with appropriate units
 */
export function formatArea(sqMeters: number): string {
  if (sqMeters < 10000) {
    return `${sqMeters.toFixed(0)} m²`
  } else if (sqMeters < 1000000) {
    return `${(sqMeters / 10000).toFixed(2)} ha`
  } else {
    return `${(sqMeters / 1000000).toFixed(2)} km²`
  }
}

/**
 * Calculate the geodesic area of a polygon
 * Uses the Shoelace formula adapted for geodesic calculations
 */
export function calculatePolygonArea(latlngs: L.LatLng[]): number {
  if (!latlngs || latlngs.length < 3) return 0

  const EARTH_RADIUS = 6378137 // meters

  let total = 0
  const pts = latlngs

  for (let i = 0, l = pts.length; i < l; i++) {
    const p1 = pts[i]
    const p2 = pts[(i + 1) % l]
    
    total += (p2.lng - p1.lng) * Math.PI / 180 *
             (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180))
  }

  return Math.abs(total * EARTH_RADIUS * EARTH_RADIUS / 2)
}

/**
 * Calculate circle area
 */
export function calculateCircleArea(radius: number): number {
  return Math.PI * radius * radius
}

/**
 * Calculate the scale bar text based on zoom level and map center
 */
export function calculateScaleText(zoom: number, lat: number): string {
  const metersPerPixel = 156543.03392 * Math.cos(lat * Math.PI / 180) / Math.pow(2, zoom)
  const scaleWidth = 80 // pixels
  const meters = metersPerPixel * scaleWidth

  if (meters < 1000) {
    return `${Math.round(meters)} m`
  } else {
    return `${(meters / 1000).toFixed(1)} km`
  }
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`
}

/**
 * Validate if coordinates are within valid bounds
 */
export function isValidCoordinate(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

/**
 * Create a feature object from a Leaflet layer
 */
export function createFeatureFromLayer(
  layer: L.Layer,
  type: FeatureType,
  name: string,
  existingFeatureCount: number
): AOIFeature {
  let coordinates: AOIFeature['coordinates']
  let area = 0

  if (type === 'polygon' || type === 'rectangle') {
    const polygonLayer = layer as L.Polygon
    const latlngs = polygonLayer.getLatLngs()[0] as L.LatLng[]
    coordinates = latlngs.map(ll => [ll.lat, ll.lng])
    area = calculatePolygonArea(latlngs)
  } else if (type === 'circle') {
    const circleLayer = layer as L.Circle
    const center = circleLayer.getLatLng()
    const radius = circleLayer.getRadius()
    coordinates = { center: [center.lat, center.lng], radius }
    area = calculateCircleArea(radius)
  } else {
    // Marker
    const markerLayer = layer as L.Marker
    const pos = markerLayer.getLatLng()
    coordinates = [pos.lat, pos.lng]
  }

  return {
    id: generateId(),
    name: name || `AOI ${existingFeatureCount + 1}`,
    type,
    coordinates,
    area: area > 0 ? area : undefined,
    color: FEATURE_COLORS[type],
    createdAt: new Date().toISOString()
  }
}

/**
 * Get the icon for a feature type
 */
export function getFeatureTypeIcon(type: FeatureType): string {
  const icons: Record<FeatureType, string> = {
    polygon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5z',
    rectangle: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z',
    circle: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    marker: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z'
  }
  return icons[type]
}

/**
 * Calculate bounds for a feature
 */
export function getFeatureBounds(feature: AOIFeature): L.LatLngBounds | null {
  if (!feature.coordinates) return null

  if (feature.type === 'marker') {
    const coords = feature.coordinates as number[]
    return L.latLngBounds([[coords[0], coords[1]], [coords[0], coords[1]]])
  }

  if (feature.type === 'circle') {
    const coords = feature.coordinates as { center: number[]; radius: number }
    const center = L.latLng(coords.center[0], coords.center[1])
    // Approximate bounds
    const latOffset = coords.radius / 111320
    const lngOffset = coords.radius / (111320 * Math.cos(center.lat * Math.PI / 180))
    return L.latLngBounds([
      [center.lat - latOffset, center.lng - lngOffset],
      [center.lat + latOffset, center.lng + lngOffset]
    ])
  }

  // Polygon or Rectangle
  const coords = feature.coordinates as number[][]
  return L.latLngBounds(coords.map(c => [c[0], c[1]] as [number, number]))
}

// Performance utilities

/**
 * Batch DOM updates using requestAnimationFrame
 */
export function batchUpdate(callback: () => void): void {
  requestAnimationFrame(callback)
}

/**
 * Check if a point is within viewport bounds (for virtualization)
 */
export function isInViewport(
  point: L.LatLng,
  bounds: L.LatLngBounds,
  buffer = 0.1
): boolean {
  const latBuffer = (bounds.getNorth() - bounds.getSouth()) * buffer
  const lngBuffer = (bounds.getEast() - bounds.getWest()) * buffer

  const expandedBounds = L.latLngBounds(
    [bounds.getSouth() - latBuffer, bounds.getWest() - lngBuffer],
    [bounds.getNorth() + latBuffer, bounds.getEast() + lngBuffer]
  )

  return expandedBounds.contains(point)
}

// Import L for type checking (will be available at runtime)
declare const L: typeof import('leaflet')