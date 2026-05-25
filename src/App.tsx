import { useState, useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet-draw'
import './index.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon   from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow })

// ─── Types ────────────────────────────────────────────────────────────────
type FeatureType = 'polygon' | 'rectangle' | 'circle' | 'marker'
type ToastType   = 'success' | 'error' | 'info' | 'warning'
export type ViewType = 'map' | 'analytics' | 'settings'

interface AOIFeature {
  id: string
  name: string
  type: FeatureType
  coordinates: number[][] | { center: number[]; radius: number } | number[]
  area?: number
  color: string
  createdAt: string
}
interface AppNotification {
  id: string
  title: string
  message: string
  read: boolean
  timestamp: string
}
interface Toast { message: string; type: ToastType }

// ─── Constants ────────────────────────────────────────────────────────────
const DEFAULT_CENTER: [number, number] = [20.5937, 78.9629]
const DEFAULT_ZOOM = 5
const FEATURE_COLORS: Record<FeatureType, string> = {
  polygon:   '#3b8beb',
  rectangle: '#00e5a0',
  circle:    '#9d6bff',
  marker:    '#ff4d6a',
}
const DEFAULT_NOTIFICATIONS: AppNotification[] = [
  { id: '1', title: 'Welcome to AOIstudio', message: 'Select a drawing tool to define your first area of interest.', read: false, timestamp: new Date().toISOString() },
  { id: '2', title: 'Pro tip', message: 'Use the search bar to fly to any location in seconds.', read: false, timestamp: new Date().toISOString() },
]

// ─── Utils ────────────────────────────────────────────────────────────────
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
function fmtArea(m: number): string {
  if (m < 10000) return `${m.toFixed(0)} m²`
  if (m < 1e6)   return `${(m / 10000).toFixed(2)} ha`
  return `${(m / 1e6).toFixed(2)} km²`
}
function fmtCoords(lat: number, lng: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}  ${Math.abs(lng).toFixed(4)}°${lng >= 0 ? 'E' : 'W'}`
}
function polyArea(pts: L.LatLng[]): number {
  if (!pts || pts.length < 3) return 0
  const R = 6378137
  let total = 0
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i]
    const p2 = pts[(i + 1) % pts.length]
    total += ((p2.lng - p1.lng) * Math.PI / 180) *
             (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180))
  }
  return Math.abs(total * R * R / 2)
}
function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw) as T
  } catch { /* ignore */ }
  return fallback
}
function relTime(ts: string): string {
  const d = Date.now() - new Date(ts).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (m < 1440) return `${Math.floor(m / 60)}h ago`
  return `${Math.floor(m / 1440)}d ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-wrap">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  )
}

// Horizontal bar chart for analytics
function TypeBar({ label, value, total, color, emoji }: {
  label: string; value: number; total: number; color: string; emoji: string
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="type-bar-row">
      <div className="type-bar-left">
        <span className="type-bar-emoji">{emoji}</span>
        <span className="type-bar-label">{label}</span>
      </div>
      <div className="type-bar-track">
        <div
          className="type-bar-fill"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}40` }}
        />
      </div>
      <span className="type-bar-val">{value}</span>
    </div>
  )
}

interface AOIItemProps {
  feature: AOIFeature
  index: number
  onRemove: () => void
  onZoom: () => void
}
function AOIItem({ feature, index, onRemove, onZoom }: AOIItemProps) {
  return (
    <div className="aoi-item" style={{ animationDelay: `${index * 35}ms` }}>
      <div className="aoi-item-color-bar" style={{ background: feature.color }} />
      <div className="aoi-type-indicator" style={{ background: `${feature.color}18`, border: `1px solid ${feature.color}40` }}>
        <div className="aoi-type-dot" style={{ background: feature.color, boxShadow: `0 0 5px ${feature.color}` }} />
      </div>
      <div className="aoi-item-body">
        <div className="aoi-name">{feature.name}</div>
        <div className="aoi-meta">
          <span className="aoi-type-tag" style={{ color: feature.color }}>{feature.type}</span>
          {feature.area && <span className="aoi-area-tag">{fmtArea(feature.area)}</span>}
        </div>
      </div>
      <div className="aoi-actions">
        <button className="aoi-act-btn" onClick={onZoom} title="Zoom to">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
        <button className="aoi-act-btn del" onClick={onRemove} title="Delete">
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
              d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

interface StatCardProps { label: string; value: number; color: string; emoji: string; sub?: string }
function StatCard({ label, value, color, emoji, sub }: StatCardProps) {
  return (
    <div className="stat-card" style={{ '--c': color } as React.CSSProperties}>
      <div className="stat-card-top">
        <div className="stat-icon-wrap" style={{ background: `${color}15`, color }}>{emoji}</div>
        <div className="stat-num">{value}</div>
      </div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

// ─── Main App ───────────────────────────────────────────────────────────
export default function App() {
  const [features, setFeatures]           = useState<AOIFeature[]>(() => loadLS('aoi-features', []))
  const [activeView, setActiveView]       = useState<ViewType>('map')
  const [activeTool, setActiveTool]       = useState<string | null>(null)
  const [wmsVisible, setWmsVisible]       = useState(true)
  const [aoiVisible, setAoiVisible]       = useState(true)
  const [wmsOpacity, setWmsOpacity]       = useState(100)
  const [toasts, setToasts]               = useState<Toast[]>([])
  const [showNotifs, setShowNotifs]       = useState(false)
  const [showProfile, setShowProfile]     = useState(false)
  const [notifications, setNotifications] = useState<AppNotification[]>(() =>
    loadLS('notifs', DEFAULT_NOTIFICATIONS)
  )
  const [coords, setCoords]   = useState(fmtCoords(DEFAULT_CENTER[0], DEFAULT_CENTER[1]))
  const [zoom, setZoom]       = useState(DEFAULT_ZOOM)
  const [searchQ, setSearchQ] = useState('')
  const [searchRes, setSearchRes] = useState<Array<{ place_id: number; lat: string; lon: string; display_name: string }>>([])
  const [showSearch, setShowSearch] = useState(false)
  const [settingsState, setSettingsState] = useState({
    notifs: true, autoSave: true, showCoords: true, defaultZoom: 5, lang: 'en'
  })

  const mapContRef  = useRef<HTMLDivElement>(null)
  const mapRef      = useRef<L.Map | null>(null)
  const tileRef     = useRef<L.TileLayer | null>(null)
  const drawnRef    = useRef<L.FeatureGroup | null>(null)
  const drawHandRef = useRef<{ enable(): void; disable(): void } | null>(null)
  const featureLenRef = useRef(features.length)

  useEffect(() => { featureLenRef.current = features.length }, [features.length])
  useEffect(() => { localStorage.setItem('aoi-features', JSON.stringify(features)) }, [features])
  useEffect(() => { localStorage.setItem('notifs', JSON.stringify(notifications)) }, [notifications])

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    setToasts(p => [...p, { message, type }])
    setTimeout(() => setToasts(p => p.slice(1)), 3200)
  }, [])

  const dismissToast = useCallback((index: number) => {
    setToasts(p => p.filter((_, i) => i !== index))
  }, [])

  // ── Map init ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContRef.current || mapRef.current || activeView !== 'map') return

    const map = L.map(mapContRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
      minZoom: 3,
      maxZoom: 19,
    })

    const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
    const drawn = new L.FeatureGroup()
    map.addLayer(drawn)

    mapRef.current   = map
    tileRef.current  = tile
    drawnRef.current = drawn

    map.on('mousemove', (e: L.LeafletMouseEvent) => setCoords(fmtCoords(e.latlng.lat, e.latlng.lng)))
    map.on('zoomend', () => setZoom(map.getZoom()))

    map.on('draw:created', (e: L.LeafletEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ev    = e as any
      const layer = ev.layer as L.Layer
      const type  = ev.layerType as FeatureType

      let featureCoords: AOIFeature['coordinates']
      let area = 0

      if (type === 'polygon' || type === 'rectangle') {
        const pts = (layer as unknown as L.Polygon).getLatLngs()[0] as L.LatLng[]
        featureCoords = pts.map(ll => [ll.lat, ll.lng])
        area = polyArea(pts)
      } else if (type === 'circle') {
        const c = layer as unknown as L.Circle
        featureCoords = { center: [c.getLatLng().lat, c.getLatLng().lng], radius: c.getRadius() }
        area = Math.PI * c.getRadius() ** 2
      } else {
        const mk = layer as unknown as L.Marker
        featureCoords = [mk.getLatLng().lat, mk.getLatLng().lng]
      }

      const newFeature: AOIFeature = {
        id: genId(),
        name: `AOI ${featureLenRef.current + 1}`,
        type,
        coordinates: featureCoords,
        area: area > 0 ? area : undefined,
        color: FEATURE_COLORS[type],
        createdAt: new Date().toISOString(),
      }

      drawn.addLayer(layer)
      setFeatures(p => [...p, newFeature])
      setActiveTool(null)
      toast(`${type.charAt(0).toUpperCase() + type.slice(1)} created`, 'success')
      setNotifications(p => [{
        id: genId(), title: 'AOI Created',
        message: `${newFeature.name} added to the map.`,
        read: false, timestamp: new Date().toISOString(),
      }, ...p])
    })

    map.on('draw:drawstop', () => setActiveTool(null))
    toast('Map ready', 'success')

    return () => { map.remove(); mapRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView])

  // ── Restore drawn layers ────────────────────────────────────────────────
  useEffect(() => {
    if (!drawnRef.current) return
    drawnRef.current.clearLayers()
    features.forEach(f => {
      let layer: L.Layer | null = null
      if (f.type === 'polygon')
        layer = L.polygon(f.coordinates as [number, number][], { color: f.color, fillOpacity: 0.22, weight: 2 })
      else if (f.type === 'rectangle')
        layer = L.rectangle(f.coordinates as [number, number][], { color: f.color, fillOpacity: 0.22, weight: 2 })
      else if (f.type === 'circle') {
        const c = f.coordinates as { center: number[]; radius: number }
        layer = L.circle([c.center[0], c.center[1]], { radius: c.radius, color: f.color, fillOpacity: 0.22, weight: 2 })
      } else {
        layer = L.marker(f.coordinates as [number, number])
      }
      if (layer) drawnRef.current!.addLayer(layer)
    })
  }, [features])

  // ── Layer visibility & opacity ─────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current, tile = tileRef.current
    if (!map || !tile) return
    if (wmsVisible) { if (!map.hasLayer(tile)) map.addLayer(tile) }
    else map.removeLayer(tile)
  }, [wmsVisible])

  useEffect(() => {
    const map = mapRef.current, drawn = drawnRef.current
    if (!map || !drawn) return
    if (aoiVisible) { if (!map.hasLayer(drawn)) map.addLayer(drawn) }
    else map.removeLayer(drawn)
  }, [aoiVisible])

  useEffect(() => { tileRef.current?.setOpacity(wmsOpacity / 100) }, [wmsOpacity])

  // ── Draw tool ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    drawHandRef.current?.disable()
    drawHandRef.current = null
    if (!activeTool) return

    const shapeOptions = { color: FEATURE_COLORS[activeTool as FeatureType] || '#3b8beb', fillOpacity: 0.18, weight: 2 }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LD = (L as any).Draw
    const drawMap = map as unknown as L.DrawMap
    let handler: { enable(): void; disable(): void } | null = null

    switch (activeTool) {
      case 'polygon':   handler = new LD.Polygon(drawMap, { shapeOptions });   break
      case 'rectangle': handler = new LD.Rectangle(drawMap, { shapeOptions }); break
      case 'circle':    handler = new LD.Circle(drawMap, { shapeOptions });    break
      case 'marker':    handler = new LD.Marker(drawMap, {});                  break
    }

    if (handler) { handler.enable(); drawHandRef.current = handler }
  }, [activeTool])

  // ── Search ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchQ.length < 3) { setSearchRes([]); setShowSearch(false); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQ)}&limit=5`)
        const d = await r.json() as Array<{ place_id: number; lat: string; lon: string; display_name: string }>
        setSearchRes(d)
        setShowSearch(d.length > 0)
      } catch { setSearchRes([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQ])

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) { toast('Geolocation not supported', 'error'); return }
    navigator.geolocation.getCurrentPosition(
      p => { mapRef.current?.setView([p.coords.latitude, p.coords.longitude], 15); toast('Location found', 'success') },
      () => toast('Could not get location', 'error')
    )
  }, [toast])

  const zoomToFeature = useCallback((f: AOIFeature) => {
    const map = mapRef.current; if (!map) return
    if (f.type === 'marker') {
      const c = f.coordinates as number[]
      map.setView([c[0], c[1]], 15)
    } else if (f.type === 'circle') {
      const c = f.coordinates as { center: number[]; radius: number }
      map.setView([c.center[0], c.center[1]], 14)
    } else {
      const c = f.coordinates as number[][]
      map.fitBounds(L.latLngBounds(c.map(x => [x[0], x[1]] as [number, number])), { padding: [40, 40] })
    }
  }, [])

  const removeFeature = useCallback((id: string) => {
    setFeatures(p => p.filter(x => x.id !== id))
    toast('Feature deleted', 'info')
  }, [toast])

  const clearAll = useCallback(() => {
    if (confirm('Clear all AOIs?')) { setFeatures([]); toast('Cleared', 'info') }
  }, [toast])

  const exportGeoJSON = useCallback(() => {
    if (!features.length) { toast('No features to export', 'warning'); return }
    const geojson = {
      type: 'FeatureCollection',
      features: features.map(f => ({
        type: 'Feature',
        properties: { id: f.id, name: f.name, type: f.type, area: f.area, createdAt: f.createdAt },
        geometry: f.type === 'marker'
          ? { type: 'Point', coordinates: [(f.coordinates as number[])[1], (f.coordinates as number[])[0]] }
          : {
              type: 'Polygon',
              coordinates: [
                f.type === 'circle'
                  ? (() => {
                      const c = f.coordinates as { center: number[]; radius: number }
                      return Array.from({ length: 33 }, (_, idx) => {
                        const a = (idx / 32) * 2 * Math.PI
                        return [
                          c.center[1] + (c.radius / (111320 * Math.cos(c.center[0] * Math.PI / 180))) * Math.sin(a),
                          c.center[0] + (c.radius / 111320) * Math.cos(a),
                        ]
                      })
                    })()
                  : [
                      ...(f.coordinates as number[][]).map(c => [c[1], c[0]]),
                      [(f.coordinates as number[][])[0][1], (f.coordinates as number[][])[0][0]],
                    ],
              ],
            },
      })),
    }
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `aoi-${Date.now()}.geojson`; a.click()
    URL.revokeObjectURL(url)
    toast('GeoJSON exported', 'success')
  }, [features, toast])

  const markAllRead  = useCallback(() => setNotifications(p => p.map(n => ({ ...n, read: true }))), [])
  const clearNotifs  = useCallback(() => { setNotifications([]); toast('Cleared', 'info') }, [toast])
  const saveSettings = useCallback(() => {
    localStorage.setItem('app-settings', JSON.stringify(settingsState))
    toast('Settings saved', 'success')
  }, [settingsState, toast])

  const unread    = notifications.filter(n => !n.read).length
  const totalArea = features.reduce((s, f) => s + (f.area ?? 0), 0)
  const withArea  = features.filter(f => f.area)
  const avgArea   = withArea.length > 0 ? totalArea / withArea.length : 0

  const tools: Array<{ id: FeatureType; label: string; hint: string; svgD: string }> = [
    {
      id: 'polygon', label: 'Polygon', hint: 'Draw a custom polygon',
      svgD: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'
    },
    {
      id: 'rectangle', label: 'Rect', hint: 'Draw a rectangle',
      svgD: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z'
    },
    {
      id: 'circle', label: 'Circle', hint: 'Draw a circle',
      svgD: 'M12 22a10 10 0 100-20 10 10 0 000 20z'
    },
    {
      id: 'marker', label: 'Pin', hint: 'Drop a marker',
      svgD: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'
    },
  ]

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="app">

      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-mark">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="logo-text">AOI<span>studio</span></span>
          </div>

          <div className="header-divider" />

          <nav className="nav">
            {(['map', 'analytics', 'settings'] as ViewType[]).map(v => (
              <button key={v} className={`nav-btn${activeView === v ? ' active' : ''}`} onClick={() => setActiveView(v)}>
                {v === 'map' && (
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                )}
                {v === 'analytics' && (
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                )}
                {v === 'settings' && (
                  <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
                <span>{v}</span>
              </button>
            ))}
          </nav>
        </div>

        {activeView === 'map' && (
          <div className="header-search">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search any location..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onFocus={() => { if (searchRes.length > 0) setShowSearch(true) }}
              onBlur={() => setTimeout(() => setShowSearch(false), 150)}
            />
            {showSearch && (
              <div className="search-dropdown">
                {searchRes.map(r => (
                  <div key={r.place_id} className="search-item" onMouseDown={() => {
                    mapRef.current?.setView([parseFloat(r.lat), parseFloat(r.lon)], 14)
                    setSearchQ(r.display_name.split(',')[0])
                    setShowSearch(false)
                  }}>
                    <svg className="search-pin" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <div>
                      <div className="search-item-name">{r.display_name.split(',')[0]}</div>
                      <div className="search-item-full">{r.display_name}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="header-right">
          <button className="icon-btn" onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false) }}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unread > 0 && <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button className="avatar-btn" onClick={() => { setShowProfile(!showProfile); setShowNotifs(false) }}>JD</button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="app-main">

        {/* ── MAP VIEW ── */}
        {activeView === 'map' && (
          <>
            <aside className="sidebar">
              {/* Drawing Tools */}
              <div className="sidebar-section">
                <div className="section-label">
                  <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Draw Tool
                </div>
                <div className="tools-grid">
                  {tools.map(t => (
                    <button
                      key={t.id}
                      className={`tool-btn${activeTool === t.id ? ' active' : ''}`}
                      onClick={() => setActiveTool(activeTool === t.id ? null : t.id)}
                      title={t.hint}
                      aria-pressed={activeTool === t.id}
                      style={{ '--tool-color': FEATURE_COLORS[t.id] } as React.CSSProperties}
                    >
                      <svg fill="currentColor" viewBox="0 0 24 24" width="16" height="16">
                        <path d={t.svgD} />
                      </svg>
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
                {activeTool && (
                  <div className="active-tool-hint">
                    <div className="hint-pulse" style={{ background: FEATURE_COLORS[activeTool as FeatureType] }} />
                    <span>Drawing <strong>{activeTool}</strong> — click to place, double-click to finish</span>
                    <button className="hint-cancel" onClick={() => setActiveTool(null)}>✕</button>
                  </div>
                )}
                {!activeTool && features.length > 0 && (
                  <button className="btn-danger-sm" onClick={clearAll}>Clear all AOIs</button>
                )}
              </div>

              {/* Layers */}
              <div className="sidebar-section">
                <div className="section-label">
                  <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Layers
                </div>
                <div className="layer-row">
                  <div className="layer-left">
                    <div className="layer-dot blue" />
                    <div>
                      <div className="layer-name-text">Base Map</div>
                      <div className="layer-sub">OpenStreetMap tiles</div>
                    </div>
                  </div>
                  <Toggle checked={wmsVisible} onChange={setWmsVisible} />
                </div>
                <div className="layer-row">
                  <div className="layer-left">
                    <div className="layer-dot green" />
                    <div>
                      <div className="layer-name-text">AOI Overlays</div>
                      <div className="layer-sub">{features.length} feature{features.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <Toggle checked={aoiVisible} onChange={setAoiVisible} />
                </div>
                <div className="opacity-row">
                  <span className="opacity-label">Map opacity</span>
                  <span className="opacity-val">{wmsOpacity}%</span>
                </div>
                <input
                  type="range" className="slider" min={0} max={100} value={wmsOpacity}
                  style={{ '--val': `${wmsOpacity}%` } as React.CSSProperties}
                  onChange={e => setWmsOpacity(Number(e.target.value))}
                />
              </div>

              {/* AOI List */}
              <div className="aoi-section">
                <div className="aoi-header">
                  <div className="aoi-header-left">
                    <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <span className="section-label" style={{ margin: 0 }}>Areas of Interest</span>
                    <span className="aoi-count-pill">{features.length}</span>
                  </div>
                  {features.length > 0 && (
                    <button className="export-btn" onClick={exportGeoJSON}>
                      <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      GeoJSON
                    </button>
                  )}
                </div>
                <div className="aoi-list">
                  {features.length === 0 ? (
                    <div className="aoi-empty">
                      <div className="aoi-empty-icon">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </div>
                      <p>No areas yet</p>
                      <small>Pick a drawing tool above to get started</small>
                    </div>
                  ) : (
                    features.map((f, i) => (
                      <AOIItem
                        key={f.id}
                        feature={f}
                        index={i}
                        onRemove={() => removeFeature(f.id)}
                        onZoom={() => zoomToFeature(f)}
                      />
                    ))
                  )}
                </div>
              </div>
            </aside>

            {/* Map */}
            <div className="map-wrapper">
              <div ref={mapContRef} className="map-container" />

              {activeTool && (
                <div className="draw-indicator">
                  <div className="draw-pulse" style={{ background: FEATURE_COLORS[activeTool as FeatureType] }} />
                  <span>Drawing <strong>{activeTool}</strong></span>
                  <span className="draw-hint">· double-click to finish</span>
                </div>
              )}

              <div className="map-controls">
                <button className="map-ctrl-btn" onClick={() => mapRef.current?.zoomIn()} title="Zoom in">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </button>
                <button className="map-ctrl-btn" onClick={() => mapRef.current?.zoomOut()} title="Zoom out">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 12H6" />
                  </svg>
                </button>
                <div className="ctrl-divider" />
                <button className="map-ctrl-btn" onClick={() => mapRef.current?.setView(DEFAULT_CENTER, DEFAULT_ZOOM)} title="Reset view">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </button>
                <button className="map-ctrl-btn" onClick={handleLocate} title="My location">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </button>
                <button className="map-ctrl-btn"
                  onClick={() => { document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen() }}
                  title="Fullscreen"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>

              <div className="map-hud right">
                <div className="hud-row">
                  <span className="hud-label">coords</span>
                  <span className="hud-val">{coords}</span>
                </div>
                <div className="hud-row">
                  <span className="hud-label">zoom</span>
                  <span className="hud-val">{zoom}</span>
                </div>
                {features.length > 0 && (
                  <div className="hud-row">
                    <span className="hud-label">AOIs</span>
                    <span className="hud-val" style={{ color: 'var(--green)' }}>{features.length}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── ANALYTICS VIEW ── */}
        {activeView === 'analytics' && (
          <div className="full-view">
            <div className="view-container">
              <div className="view-heading-block">
                <h1 className="view-heading">Analytics</h1>
                <p className="view-sub">{features.length} area{features.length !== 1 ? 's' : ''} of interest · {totalArea > 0 ? fmtArea(totalArea) : 'no area'} total</p>
              </div>

              <div className="stats-grid">
                <StatCard label="Total AOIs"  value={features.length}                                    color="#3b8beb" emoji="◈" sub="all types" />
                <StatCard label="Polygons"    value={features.filter(f => f.type === 'polygon').length}  color="#3b8beb" emoji="⬡" />
                <StatCard label="Rectangles"  value={features.filter(f => f.type === 'rectangle').length} color="#00e5a0" emoji="▭" />
                <StatCard label="Circles"     value={features.filter(f => f.type === 'circle').length}   color="#9d6bff" emoji="◯" />
                <StatCard label="Markers"     value={features.filter(f => f.type === 'marker').length}   color="#ff4d6a" emoji="◎" />
              </div>

              <div className="analytics-grid">
                {/* Distribution chart */}
                <div className="analytics-card chart-card">
                  <div className="card-head">
                    <span>Type Distribution</span>
                    {features.length === 0 && <span className="card-empty-tag">no data</span>}
                  </div>
                  <div className="type-bars">
                    {([
                      { type: 'polygon',   label: 'Polygon',   color: '#3b8beb', emoji: '⬡' },
                      { type: 'rectangle', label: 'Rectangle', color: '#00e5a0', emoji: '▭' },
                      { type: 'circle',    label: 'Circle',    color: '#9d6bff', emoji: '◯' },
                      { type: 'marker',    label: 'Marker',    color: '#ff4d6a', emoji: '◎' },
                    ] as const).map(t => (
                      <TypeBar
                        key={t.type}
                        label={t.label}
                        value={features.filter(f => f.type === t.type).length}
                        total={features.length}
                        color={t.color}
                        emoji={t.emoji}
                      />
                    ))}
                  </div>
                </div>

                {/* Area stats */}
                <div className="analytics-card area-stats-card">
                  <div className="card-head">Coverage</div>
                  <div className="coverage-rows">
                    <div className="coverage-row">
                      <span className="coverage-label">Total area</span>
                      <span className="coverage-val" style={{ color: '#3b8beb' }}>
                        {totalArea > 0 ? fmtArea(totalArea) : '—'}
                      </span>
                    </div>
                    <div className="coverage-divider" />
                    <div className="coverage-row">
                      <span className="coverage-label">Average area</span>
                      <span className="coverage-val" style={{ color: '#00e5a0' }}>
                        {avgArea > 0 ? fmtArea(avgArea) : '—'}
                      </span>
                    </div>
                    <div className="coverage-divider" />
                    <div className="coverage-row">
                      <span className="coverage-label">Largest AOI</span>
                      <span className="coverage-val" style={{ color: '#9d6bff' }}>
                        {withArea.length > 0 ? fmtArea(Math.max(...withArea.map(f => f.area!))) : '—'}
                      </span>
                    </div>
                    <div className="coverage-divider" />
                    <div className="coverage-row">
                      <span className="coverage-label">With area data</span>
                      <span className="coverage-val">{withArea.length} / {features.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent features table */}
              <div className="recent-card">
                <div className="recent-head">
                  <span>Recent Features</span>
                  {features.length > 0 && (
                    <button className="export-btn" onClick={exportGeoJSON}>
                      <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Export all
                    </button>
                  )}
                </div>
                {features.length === 0 ? (
                  <div className="empty-state">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    <p>No features yet</p>
                    <small>Go to map view and draw some AOIs to see them here</small>
                  </div>
                ) : (
                  [...features].reverse().slice(0, 15).map(f => (
                    <div key={f.id} className="recent-row">
                      <div className="recent-left">
                        <div className="recent-color-swatch" style={{ background: f.color, boxShadow: `0 0 6px ${f.color}60` }} />
                        <div>
                          <div className="recent-name">{f.name}</div>
                          <div className="recent-type" style={{ color: f.color }}>{f.type}</div>
                        </div>
                      </div>
                      <div className="recent-right">
                        <div className="recent-area">{f.area ? fmtArea(f.area) : <span style={{ color: 'var(--text-dim)' }}>marker</span>}</div>
                        <div className="recent-date">{relTime(f.createdAt)}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS VIEW ── */}
        {activeView === 'settings' && (
          <div className="full-view">
            <div className="view-container">
              <div className="view-heading-block">
                <h1 className="view-heading">Settings</h1>
                <p className="view-sub">Application preferences and data management</p>
              </div>

              <div className="settings-block">
                <div className="settings-block-head">General</div>
                {([
                  { key: 'notifs' as const,     label: 'Notifications', desc: 'Receive in-app notifications for new AOIs' },
                  { key: 'autoSave' as const,   label: 'Auto-save',     desc: 'Persist areas of interest between sessions' },
                  { key: 'showCoords' as const, label: 'Coordinate HUD', desc: 'Show live cursor coordinates on the map' },
                ]).map(s => (
                  <div key={s.key} className="settings-row">
                    <div className="settings-info"><h3>{s.label}</h3><p>{s.desc}</p></div>
                    <Toggle
                      checked={settingsState[s.key]}
                      onChange={v => setSettingsState(p => ({ ...p, [s.key]: v }))}
                    />
                  </div>
                ))}
              </div>

              <div className="settings-block">
                <div className="settings-block-head">Map</div>
                <div className="settings-row">
                  <div className="settings-info"><h3>Default Zoom</h3><p>Initial zoom level when the map loads</p></div>
                  <select className="select-input" value={settingsState.defaultZoom}
                    onChange={e => setSettingsState(p => ({ ...p, defaultZoom: Number(e.target.value) }))}>
                    {[3, 4, 5, 6, 8, 10, 12].map(z => <option key={z} value={z}>Zoom {z}</option>)}
                  </select>
                </div>
                <div className="settings-row">
                  <div className="settings-info"><h3>Language</h3><p>UI display language</p></div>
                  <select className="select-input" value={settingsState.lang}
                    onChange={e => setSettingsState(p => ({ ...p, lang: e.target.value }))}>
                    <option value="en">English</option>
                    <option value="hi">हिंदी</option>
                    <option value="ta">தமிழ்</option>
                    <option value="te">తెలుగు</option>
                  </select>
                </div>
              </div>

              <div className="settings-block">
                <div className="settings-block-head">Data</div>
                <div className="settings-row">
                  <div className="settings-info">
                    <h3>{features.length} feature{features.length !== 1 ? 's' : ''} stored</h3>
                    <p>Total area coverage: {totalArea > 0 ? fmtArea(totalArea) : 'none'}</p>
                  </div>
                  <button className="btn-export-sm" onClick={exportGeoJSON}>Export GeoJSON</button>
                </div>
                <div className="settings-row">
                  <div className="settings-info danger"><h3>Reset Everything</h3><p>Delete all features and reset all settings</p></div>
                  <button className="btn-danger-outline"
                    onClick={() => { if (confirm('This will delete all features and settings. Continue?')) { localStorage.clear(); window.location.reload() } }}>
                    Reset
                  </button>
                </div>
              </div>

              <div className="settings-actions">
                <button className="btn-secondary-sm" onClick={() => setActiveView('map')}>Cancel</button>
                <button className="btn-primary" onClick={saveSettings}>Save Settings</button>
              </div>
              <div className="settings-footer">AOIstudio v2.1 · React + TypeScript + Leaflet · MIT</div>
            </div>
          </div>
        )}

        {/* ── NOTIFICATION PANEL ── */}
        {showNotifs && (
          <>
            <div className="panel-backdrop" onClick={() => setShowNotifs(false)} />
            <div className="notif-panel">
              <div className="panel-header">
                <span className="panel-title">Notifications</span>
                <div className="panel-actions">
                  {notifications.some(n => !n.read) && (
                    <button className="clear-link" onClick={markAllRead}>mark all read</button>
                  )}
                  {notifications.length > 0 && (
                    <button className="clear-link" onClick={clearNotifs}>clear all</button>
                  )}
                  <button className="close-btn" onClick={() => setShowNotifs(false)}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="notif-list">
                {notifications.length === 0 ? (
                  <div className="notif-empty">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <p>All caught up</p>
                  </div>
                ) : (
                  notifications.map((n, i) => (
                    <div
                      key={n.id}
                      className={`notif-item${n.read ? '' : ' unread'}`}
                      onClick={() => setNotifications(p => p.map(x => x.id === n.id ? { ...x, read: true } : x))}
                      style={{ animationDelay: `${i * 30}ms` }}
                    >
                      <div className={`notif-dot ${n.read ? 'read' : 'unread'}`} />
                      <div className="notif-content">
                        <div className="notif-top">
                          <span className="notif-title">{n.title}</span>
                          <span className="notif-time">{relTime(n.timestamp)}</span>
                        </div>
                        <p className="notif-msg">{n.message}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* ── PROFILE POPUP ── */}
        {showProfile && (
          <>
            <div className="panel-backdrop" onClick={() => setShowProfile(false)} />
            <div className="profile-popup">
              <div className="profile-top">
                <div className="profile-avatar-lg">JD</div>
                <div>
                  <div className="profile-name">John Doe</div>
                  <div className="profile-email">john@example.com</div>
                </div>
              </div>
              <div className="profile-stats-row">
                <div className="profile-stat">
                  <span className="profile-stat-num">{features.length}</span>
                  <span className="profile-stat-label">AOIs</span>
                </div>
                <div className="profile-stat-divider" />
                <div className="profile-stat">
                  <span className="profile-stat-num">{totalArea > 0 ? fmtArea(totalArea) : '—'}</span>
                  <span className="profile-stat-label">Total area</span>
                </div>
              </div>
              <div className="profile-menu">
                {[
                  { label: 'My Profile',   icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
                  { label: 'Settings',     icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
                  { label: 'Documentation', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                ].map(item => (
                  <button key={item.label} className="profile-item"
                    onClick={() => { toast(`${item.label} coming soon`, 'info'); setShowProfile(false) }}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                    </svg>
                    {item.label}
                  </button>
                ))}
                <div className="profile-sep" />
                <button className="profile-item logout"
                  onClick={() => { toast('Signed out', 'success'); setShowProfile(false) }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── TOASTS ── */}
      <div className="toast-stack">
        {toasts.map((t, i) => (
          <div key={i} className={`toast ${t.type}`} onClick={() => dismissToast(i)}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="14" height="14">
              {t.type === 'success' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />}
              {t.type === 'error'   && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />}
              {t.type === 'info'    && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
              {t.type === 'warning' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />}
            </svg>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
