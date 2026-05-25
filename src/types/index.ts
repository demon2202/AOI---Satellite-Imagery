import type L from 'leaflet'

// ─── View Types ────────────────────────────────────────────────────────────
export type ViewType = 'map' | 'analytics' | 'settings'

// ─── Feature Types ─────────────────────────────────────────────────────────
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

// ─── Toast / Notification ─────────────────────────────────────────────────
export interface ToastMessage {
  id: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
}

export interface Notification {
  id: string
  title: string
  message: string
  read: boolean
  timestamp: string
}

// ─── Application State ────────────────────────────────────────────────────
export interface AppState {
  features: AOIFeature[]
  activeTool: string | null
  wmsVisible: boolean
  aoiVisible: boolean
  wmsOpacity: number
  mapRef: L.Map | null
}

// ─── Search ───────────────────────────────────────────────────────────────
export interface SearchResult {
  place_id: number
  lat: string
  lon: string
  display_name: string
  type: string
}

// ─── Component Props ──────────────────────────────────────────────────────
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

export interface DrawingTool {
  id: string
  name: string
  icon: React.ReactNode
  type: FeatureType
}

// Convenience alias so mapStore can keep its existing structure
export type { AOIFeature as Feature }
