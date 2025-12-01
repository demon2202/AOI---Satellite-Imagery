import type L from 'leaflet'

// Feature types for AOI
export type FeatureType = 'polygon' | 'rectangle' | 'circle' | 'marker'

export interface AOIFeature {
  id: string
  name: string
  type: FeatureType
  coordinates: number[][] | { center: number[]; radius: number } | number[]
  area?: number
  color: string
  createdAt: string
}

// Toast notification types
export interface ToastMessage {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

// Notification type
export interface Notification {
  id: string
  title: string
  message: string
  read: boolean
  timestamp: string
}

// Application state
export interface AppState {
  features: AOIFeature[]
  activeTool: string | null
  wmsVisible: boolean
  aoiVisible: boolean
  wmsOpacity: number
  mapRef: L.Map | null
}

// Search result from Nominatim
export interface SearchResult {
  place_id: number
  lat: string
  lon: string
  display_name: string
  type: string
}

// Map configuration
export interface MapConfig {
  center: [number, number]
  zoom: number
  wmsUrl: string
  wmsLayer: string
}

// Drawing tool config
export interface DrawingTool {
  id: string
  name: string
  icon: React.ReactNode
  type: FeatureType
}

// Layer info
export interface LayerInfo {
  id: string
  name: string
  description: string
  visible: boolean
  opacity?: number
}

// Coordinates display
export interface Coordinates {
  lat: number
  lng: number
}

// Map event types for better type safety
export interface MapMouseEvent {
  latlng: L.LatLng
  containerPoint: L.Point
  layerPoint: L.Point
  originalEvent: MouseEvent
}

// Feature layer with ID tracking
export interface FeatureLayer extends L.Layer {
  featureId?: string
}

// Props interfaces for components
export interface SidebarProps {
  features: AOIFeature[]
  activeTool: string | null
  wmsVisible: boolean
  aoiVisible: boolean
  wmsOpacity: number
  onToolChange: (tool: string | null) => void
  onWmsToggle: (visible: boolean) => void
  onAoiToggle: (visible: boolean) => void
  onOpacityChange: (opacity: number) => void
  onFeatureRemove: (id: string) => void
  onFeatureUpdate: (id: string, updates: Partial<AOIFeature>) => void
  onClearAll: () => void
  onExport: () => void
  mapRef: L.Map | null
}

export interface MapContainerProps {
  appState: AppState
  onMapReady: (map: L.Map) => void
  onFeatureAdd: (feature: AOIFeature) => void
  onToolComplete: () => void
  showToast: (message: string, type?: ToastMessage['type']) => void
}

export interface DrawingToolsProps {
  activeTool: string | null
  onToolChange: (tool: string | null) => void
  onClearAll: () => void
}

export interface LayerManagerProps {
  wmsVisible: boolean
  aoiVisible: boolean
  wmsOpacity: number
  featureCount: number
  onWmsToggle: (visible: boolean) => void
  onAoiToggle: (visible: boolean) => void
  onOpacityChange: (opacity: number) => void
}

export interface MapControlsProps {
  mapRef: L.Map | null
  showToast: (message: string, type?: ToastMessage['type']) => void
}

export interface SearchBarProps {
  mapRef: L.Map | null
}

export interface ToastProps {
  message: string
  type: ToastMessage['type']
  onClose: () => void
}

export interface AOIListProps {
  features: AOIFeature[]
  onFeatureRemove: (id: string) => void
  onFeatureUpdate: (id: string, updates: Partial<AOIFeature>) => void
  onExport: () => void
  mapRef: L.Map | null
}