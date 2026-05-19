import { useState, useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet-draw'
import './index.css'

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon   from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow })

// ─── Types ────────────────────────────────────────────────────────────────────
interface AOIFeature {
  id: string
  name: string
  type: 'polygon' | 'rectangle' | 'circle' | 'marker'
  coordinates: number[][] | { center: number[]; radius: number } | number[]
  area?: number
  color: string
  createdAt: string
}
interface Notification { id: string; title: string; message: string; read: boolean; timestamp: string }
interface Toast        { id: string; message: string; type: 'success' | 'error' | 'info' | 'warning' }
type ViewType = 'map' | 'analytics' | 'settings'

// ─── Config ───────────────────────────────────────────────────────────────────
const MAP_CONFIG = {
  DEFAULT_CENTER: [20.5937, 78.9629] as [number, number],
  DEFAULT_ZOOM: 5, MIN_ZOOM: 3, MAX_ZOOM: 19
}
const FEATURE_COLORS = { polygon:'#3b8beb', rectangle:'#00e5a0', circle:'#9d6bff', marker:'#ff4d6a' }

// ─── Utils ────────────────────────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2)
const fmtArea = (m: number) => m < 10000 ? `${m.toFixed(0)} m²` : m < 1e6 ? `${(m/10000).toFixed(2)} ha` : `${(m/1e6).toFixed(2)} km²`
const fmtCoords = (lat: number, lng: number) =>
  `${Math.abs(lat).toFixed(4)}°${lat>=0?'N':'S'}, ${Math.abs(lng).toFixed(4)}°${lng>=0?'E':'W'}`
const polyArea = (pts: L.LatLng[]) => {
  if (!pts || pts.length < 3) return 0
  const R = 6378137; let t = 0
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i], p2 = pts[(i+1)%pts.length]
    t += (p2.lng-p1.lng)*Math.PI/180*(2+Math.sin(p1.lat*Math.PI/180)+Math.sin(p2.lat*Math.PI/180))
  }
  return Math.abs(t*R*R/2)
}

// ─── Lightswind Toggle Component ─────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-wrap">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="toggle-track" />
      <div className="toggle-thumb" />
    </label>
  )
}

// ─── Lightswind Border-Beam Tool Button ──────────────────────────────────────
function ToolBtn({ id, active, label, icon, onClick }:
  { id:string; active:boolean; label:string; icon:React.ReactNode; onClick:()=>void }) {
  return (
    <button
      className={`tool-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
      title={`Draw ${label}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ─── ReactBits AnimatedList item ─────────────────────────────────────────────
function AOIItem({ feature, onRemove, onZoom, index }:
  { feature: AOIFeature; onRemove: () => void; onZoom: () => void; index: number }) {
  return (
    <div
      className="aoi-item"
      style={{
        animationDelay: `${index * 40}ms`,
        '--border-left-color': feature.color,
      } as React.CSSProperties}
    >
      <div className="aoi-item" style={{
        position:'absolute', left:0, top:0, bottom:0, width:2,
        background: feature.color,
        borderRadius:'0 2px 2px 0',
        opacity:0.8,
      }} />
      <div className="aoi-item-left" style={{ paddingLeft: 8 }}>
        <div className="aoi-type-dot" style={{ background: feature.color, boxShadow: `0 0 6px ${feature.color}` }} />
        <div style={{ minWidth:0 }}>
          <div className="aoi-name">{feature.name}</div>
          <div className="aoi-meta">{feature.type}{feature.area ? ` · ${fmtArea(feature.area)}` : ''}</div>
        </div>
      </div>
      <div className="aoi-actions">
        <button className="aoi-act-btn" onClick={onZoom} title="Zoom to">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/>
          </svg>
        </button>
        <button className="aoi-act-btn del" onClick={onRemove} title="Delete">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── Notification item (ReactBits AnimatedList style) ─────────────────────────
function NotifItem({ n, onClick, index }: { n: Notification; onClick: () => void; index: number }) {
  const diff = Date.now() - new Date(n.timestamp).getTime()
  const mins = Math.floor(diff/60000)
  const ago  = mins < 1 ? 'now' : mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins/60)}h` : `${Math.floor(mins/1440)}d`
  return (
    <div className={`notif-item ${n.read?'':'unread'}`} onClick={onClick}
      style={{ animationDelay: `${index*35}ms` }}>
      <div className={`notif-dot ${n.read?'read':'unread'}`} />
      <div className="notif-content">
        <div className="notif-top">
          <span className="notif-title">{n.title}</span>
          <span className="notif-time">{ago} ago</span>
        </div>
        <p className="notif-msg">{n.message}</p>
      </div>
    </div>
  )
}

// ─── Lightswind Stat Card ─────────────────────────────────────────────────────
function StatCard({ label, value, color, emoji }: { label:string; value:number; color:string; emoji:string }) {
  return (
    <div className="stat-card" style={{ '--c': color } as React.CSSProperties}>
      <div className="stat-icon-wrap" style={{ background:`${color}18` }}>
        <span>{emoji}</span>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-num">{value}</div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [features, setFeatures]         = useState<AOIFeature[]>(() => { try { return JSON.parse(localStorage.getItem('aoi-features')||'[]') } catch { return [] } })
  const [activeView, setActiveView]     = useState<ViewType>('map')
  const [activeTool, setActiveTool]     = useState<string|null>(null)
  const [wmsVisible, setWmsVisible]     = useState(true)
  const [aoiVisible, setAoiVisible]     = useState(true)
  const [wmsOpacity, setWmsOpacity]     = useState(100)
  const [toasts, setToasts]             = useState<Toast[]>([])
  const [showNotifs, setShowNotifs]     = useState(false)
  const [showProfile, setShowProfile]   = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('notifs') || 'null')
      if (Array.isArray(saved)) return saved
    } catch { /* ignore */ }
    return [
      { id:'1', title:'Welcome', message:'Draw an AOI on the map to get started.', read:false, timestamp:new Date().toISOString() },
      { id:'2', title:'Tip', message:'Use the search bar to fly to any location.', read:false, timestamp:new Date().toISOString() },
    ]
  })
  const [coords, setCoords]             = useState(fmtCoords(MAP_CONFIG.DEFAULT_CENTER[0], MAP_CONFIG.DEFAULT_CENTER[1]))
  const [zoom, setZoom]                 = useState(MAP_CONFIG.DEFAULT_ZOOM)
  const [searchQ, setSearchQ]           = useState('')
  const [searchRes, setSearchRes]       = useState<Array<{place_id:number;lat:string;lon:string;display_name:string}>>([])
  const [showSearch, setShowSearch]     = useState(false)
  const [settings, setSettings]         = useState({ darkMode:true, notifs:true, autoSave:true, coords:true, defaultZoom:5, lang:'en' })

  const mapContRef   = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<L.Map|null>(null)
  const tileRef      = useRef<L.TileLayer|null>(null)
  const drawnRef     = useRef<L.FeatureGroup|null>(null)
  const drawHandRef  = useRef<{enable:()=>void;disable:()=>void}|null>(null)

  useEffect(() => { localStorage.setItem('aoi-features', JSON.stringify(features)) }, [features])
  useEffect(() => { localStorage.setItem('notifs', JSON.stringify(notifications)) }, [notifications])

  const toast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = uid()
    setToasts(p => [...p, { id, message, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200)
  }, [])

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContRef.current || mapRef.current || activeView !== 'map') return
    const map = L.map(mapContRef.current, {
      center: MAP_CONFIG.DEFAULT_CENTER, zoom: MAP_CONFIG.DEFAULT_ZOOM,
      zoomControl: false, attributionControl: false,
      minZoom: MAP_CONFIG.MIN_ZOOM, maxZoom: MAP_CONFIG.MAX_ZOOM,
    })
    const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom:19 }).addTo(map)
    const drawn = new L.FeatureGroup()
    map.addLayer(drawn)
    mapRef.current = map; tileRef.current = tile; drawnRef.current = drawn

    map.on('mousemove', (e: L.LeafletMouseEvent) => setCoords(fmtCoords(e.latlng.lat, e.latlng.lng)))
    map.on('zoomend', () => setZoom(map.getZoom()))

    map.on('draw:created', (e: L.LeafletEvent) => {
      const ev    = e as L.DrawEvents.Created
      const layer = ev.layer
      const type  = ev.layerType as AOIFeature['type']
      let coords2: AOIFeature['coordinates'], area = 0
      if (type === 'polygon' || type === 'rectangle') {
        const pts = (layer as L.Polygon).getLatLngs()[0] as L.LatLng[]
        coords2 = pts.map(ll => [ll.lat, ll.lng]); area = polyArea(pts)
      } else if (type === 'circle') {
        const c = layer as L.Circle
        coords2 = { center: [c.getLatLng().lat, c.getLatLng().lng], radius: c.getRadius() }
        area = Math.PI * c.getRadius() ** 2
      } else {
        const m = layer as L.Marker
        coords2 = [m.getLatLng().lat, m.getLatLng().lng]
      }
      const feature: AOIFeature = {
        id: uid(), name: `AOI ${features.length + 1}`,
        type, coordinates: coords2, area: area > 0 ? area : undefined,
        color: FEATURE_COLORS[type], createdAt: new Date().toISOString()
      }
      drawn.addLayer(layer)
      setFeatures(p => [...p, feature])
      setActiveTool(null)
      toast(`${type.charAt(0).toUpperCase()+type.slice(1)} created`, 'success')
      setNotifications(p => [{ id:uid(), title:'AOI Created', message:`${feature.name} added.`, read:false, timestamp:new Date().toISOString() }, ...p])
    })
    map.on('draw:drawstop', () => setActiveTool(null))
    toast('Map loaded — India', 'success')
    return () => { map.remove(); mapRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView])

  // ── Restore drawn features ──────────────────────────────────────────────────
  useEffect(() => {
    if (!drawnRef.current || !mapRef.current) return
    drawnRef.current.clearLayers()
    features.forEach(f => {
      let layer: L.Layer|null = null
      if (f.type==='polygon')   layer = L.polygon(f.coordinates as [number,number][], { color:f.color, fillOpacity:0.25 })
      if (f.type==='rectangle') layer = L.rectangle(f.coordinates as [number,number][], { color:f.color, fillOpacity:0.25 })
      if (f.type==='circle') {
        const c = f.coordinates as { center:number[];radius:number }
        layer = L.circle([c.center[0],c.center[1]], { radius:c.radius, color:f.color, fillOpacity:0.25 })
      }
      if (f.type==='marker') layer = L.marker(f.coordinates as [number,number])
      if (layer) drawnRef.current!.addLayer(layer)
    })
  }, [features])

  // ── Layer visibility & opacity ──────────────────────────────────────────────
  useEffect(() => {
    if (!tileRef.current || !mapRef.current) return
    wmsVisible ? mapRef.current.hasLayer(tileRef.current) || mapRef.current.addLayer(tileRef.current)
               : mapRef.current.removeLayer(tileRef.current)
  }, [wmsVisible])
  useEffect(() => {
    if (!drawnRef.current || !mapRef.current) return
    aoiVisible ? mapRef.current.hasLayer(drawnRef.current) || mapRef.current.addLayer(drawnRef.current)
               : mapRef.current.removeLayer(drawnRef.current)
  }, [aoiVisible])
  useEffect(() => { tileRef.current?.setOpacity(wmsOpacity/100) }, [wmsOpacity])

  // ── Draw tool activation ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current; if (!map) return
    drawHandRef.current?.disable(); drawHandRef.current = null
    if (!activeTool) return
    const opts = { shapeOptions: { color:'#3b8beb', fillOpacity:0.2 } }
    const m = map as unknown as L.DrawMap
    let h: typeof drawHandRef.current = null
    if (activeTool==='polygon')   h = new L.Draw.Polygon(m,opts)   as typeof h
    if (activeTool==='rectangle') h = new L.Draw.Rectangle(m,opts) as typeof h
    if (activeTool==='circle')    h = new L.Draw.Circle(m,opts)    as typeof h
    if (activeTool==='marker')    h = new L.Draw.Marker(m,{})      as typeof h
    if (h) { h.enable(); drawHandRef.current = h }
  }, [activeTool])

  // ── Search ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchQ.length < 3) { setSearchRes([]); setShowSearch(false); return }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQ)}&limit=5`)
        const d = await r.json()
        setSearchRes(d); setShowSearch(d.length > 0)
      } catch { setSearchRes([]) }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQ])

  // ── Map control handlers ────────────────────────────────────────────────────
  const handleLocate = () => {
    if (!navigator.geolocation) { toast('Geolocation not supported','error'); return }
    navigator.geolocation.getCurrentPosition(
      p => { mapRef.current?.setView([p.coords.latitude, p.coords.longitude], 15); toast('Location found','success') },
      () => toast('Could not get location','error')
    )
  }
  const zoomToFeature = (f: AOIFeature) => {
    if (!mapRef.current) return
    if (f.type==='marker') {
      const c = f.coordinates as number[]
      mapRef.current.setView([c[0],c[1]], 15)
    } else if (f.type==='circle') {
      const c = f.coordinates as { center:number[];radius:number }
      mapRef.current.setView([c.center[0],c.center[1]], 14)
    } else {
      const c = f.coordinates as number[][]
      mapRef.current.fitBounds(L.latLngBounds(c.map(x=>[x[0],x[1]] as [number,number])), { padding:[40,40] })
    }
  }
  const exportGeoJSON = () => {
    if (!features.length) { toast('No features to export','warning'); return }
    const geojson = {
      type:'FeatureCollection',
      features: features.map(f => ({
        type:'Feature',
        properties:{ id:f.id, name:f.name, type:f.type, area:f.area, createdAt:f.createdAt },
        geometry: f.type==='marker'
          ? { type:'Point', coordinates:[(f.coordinates as number[])[1],(f.coordinates as number[])[0]] }
          : { type:'Polygon', coordinates:[f.type==='circle'
              ? (() => { const c=f.coordinates as {center:number[];radius:number}; const pts:number[][]=[]
                  for(let i=0;i<=32;i++){const a=i/32*2*Math.PI;pts.push([c.center[1]+(c.radius/(111320*Math.cos(c.center[0]*Math.PI/180)))*Math.sin(a),c.center[0]+(c.radius/111320)*Math.cos(a)])}
                  return pts })()
              : [...(f.coordinates as number[][]).map(c=>[c[1],c[0]]),(f.coordinates as number[][])[0]?[((f.coordinates as number[][])[0][1]),((f.coordinates as number[][])[0][0])]:[]]
            ] }
      }))
    }
    const blob = new Blob([JSON.stringify(geojson,null,2)],{type:'application/json'})
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href=url; a.download='aoi.geojson'; a.click()
    URL.revokeObjectURL(url)
    toast('Exported GeoJSON','success')
  }

  const unread = notifications.filter(n=>!n.read).length
  const totalArea = features.reduce((s,f)=>s+(f.area||0),0)
  const avgArea   = features.filter(f=>f.area).length > 0 ? totalArea/features.filter(f=>f.area).length : 0

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <div className="logo-mark">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <span className="logo-text">AOI<span>studio</span></span>
          </div>
          <div className="header-divider" />
          <nav className="nav">
            {(['map','analytics','settings'] as ViewType[]).map(v => (
              <button key={v} className={`nav-btn ${activeView===v?'active':''}`} onClick={()=>setActiveView(v)}>
                {v}
              </button>
            ))}
          </nav>
        </div>

        {activeView==='map' && (
          <div className="header-search">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text" placeholder="Search location..." value={searchQ}
              onChange={e=>setSearchQ(e.target.value)}
              onFocus={()=>searchRes.length>0&&setShowSearch(true)}
              onBlur={()=>setTimeout(()=>setShowSearch(false),150)}
            />
            {showSearch && (
              <div className="search-dropdown">
                {searchRes.map(r=>(
                  <div key={r.place_id} className="search-item" onMouseDown={()=>{
                    mapRef.current?.setView([parseFloat(r.lat),parseFloat(r.lon)],14)
                    setSearchQ(r.display_name.split(',')[0]); setShowSearch(false)
                  }}>
                    <div className="search-item-name">{r.display_name.split(',')[0]}</div>
                    <div className="search-item-full">{r.display_name}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="header-right">
          <button className="icon-btn" onClick={()=>{setShowNotifs(!showNotifs);setShowProfile(false)}}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
            </svg>
            {unread>0 && <span className="notif-badge">{unread>9?'9+':unread}</span>}
          </button>
          <button className="avatar-btn" onClick={()=>{setShowProfile(!showProfile);setShowNotifs(false)}}>JD</button>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="app-main">
        {/* ── MAP VIEW ── */}
        {activeView==='map' && (
          <>
            {/* Sidebar */}
            <aside className="sidebar">
              {/* Drawing Tools */}
              <div className="sidebar-section">
                <div className="section-label">Drawing Tools</div>
                <div className="tools-grid">
                  {([
                    { id:'polygon',   label:'Poly',   icon:<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/></svg> },
                    { id:'rectangle', label:'Rect',   icon:<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/></svg> },
                    { id:'circle',    label:'Circle', icon:<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth={2}/></svg> },
                    { id:'marker',    label:'Pin',    icon:<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
                  ] as const).map(t=>(
                    <ToolBtn key={t.id} id={t.id} active={activeTool===t.id} label={t.label} icon={t.icon}
                      onClick={()=>setActiveTool(activeTool===t.id?null:t.id)} />
                  ))}
                </div>
                <div className="tool-actions">
                  {activeTool && <button className="btn-cancel" onClick={()=>setActiveTool(null)}>Cancel</button>}
                  <button className="btn-danger" onClick={()=>{if(confirm('Clear all features?')){setFeatures([]);toast('Cleared','info')}}}>
                    Clear All
                  </button>
                </div>
              </div>

              {/* Layers */}
              <div className="sidebar-section">
                <div className="section-label">Layers</div>
                <div className="layer-row">
                  <div className="layer-left">
                    <div className="layer-dot blue" />
                    <div>
                      <div className="layer-name-text">Base Map</div>
                      <div className="layer-sub">OpenStreetMap</div>
                    </div>
                  </div>
                  <Toggle checked={wmsVisible} onChange={setWmsVisible} />
                </div>
                <div className="layer-row">
                  <div className="layer-left">
                    <div className="layer-dot green" />
                    <div>
                      <div className="layer-name-text">AOI Features</div>
                      <div className="layer-sub">{features.length} feature{features.length!==1?'s':''}</div>
                    </div>
                  </div>
                  <Toggle checked={aoiVisible} onChange={setAoiVisible} />
                </div>
                <div className="opacity-row">
                  <span className="opacity-label">Map Opacity</span>
                  <span className="opacity-val">{wmsOpacity}%</span>
                </div>
                <input type="range" className="slider" min={0} max={100} value={wmsOpacity}
                  style={{'--val':`${wmsOpacity}%`} as React.CSSProperties}
                  onChange={e=>setWmsOpacity(+e.target.value)} />
              </div>

              {/* AOI List — ReactBits AnimatedList */}
              <div className="aoi-section">
                <div className="aoi-header">
                  <div className="section-label" style={{margin:0}}>Areas of Interest</div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span className="aoi-count">{features.length}</span>
                    <button className="export-btn" onClick={exportGeoJSON}>export ↗</button>
                  </div>
                </div>
                <div className="aoi-list">
                  {features.length===0 ? (
                    <div className="aoi-empty">
                      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                      </svg>
                      <p>No areas defined</p>
                      <small>Use drawing tools to add AOIs</small>
                    </div>
                  ) : features.map((f,i)=>(
                    <AOIItem key={f.id} feature={f} index={i}
                      onRemove={()=>{ setFeatures(p=>p.filter(x=>x.id!==f.id)); toast('Deleted','info') }}
                      onZoom={()=>zoomToFeature(f)} />
                  ))}
                </div>
              </div>
            </aside>

            {/* Map */}
            <div className="map-wrapper">
              <div ref={mapContRef} className="map-container" />

              {activeTool && (
                <div className="draw-indicator">
                  <div className="draw-pulse" />
                  <span className="draw-label">Drawing {activeTool} — click to place points</span>
                </div>
              )}

              {/* Map controls */}
              <div className="map-controls">
                <button className="map-ctrl-btn" onClick={()=>mapRef.current?.zoomIn()} title="Zoom in">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>
                </button>
                <button className="map-ctrl-btn" onClick={()=>mapRef.current?.zoomOut()} title="Zoom out">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6"/></svg>
                </button>
                <div className="ctrl-divider" />
                <button className="map-ctrl-btn" onClick={()=>mapRef.current?.setView(MAP_CONFIG.DEFAULT_CENTER,MAP_CONFIG.DEFAULT_ZOOM)} title="Reset view">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
                </button>
                <button className="map-ctrl-btn" onClick={handleLocate} title="My location">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </button>
                <button className="map-ctrl-btn" onClick={()=>{ document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen() }} title="Fullscreen">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                </button>
              </div>

              {/* Scale HUD */}
              <div className="map-hud left">
                <div className="hud-row">
                  <div className="scale-line-wrap">
                    <div className="scale-line" />
                    <span className="hud-val">100 km</span>
                  </div>
                </div>
              </div>

              {/* Coords HUD */}
              <div className="map-hud right">
                <div className="hud-row">
                  <span className="hud-label">pos</span>
                  <span className="hud-val">{coords}</span>
                </div>
                <div className="hud-row">
                  <span className="hud-label">z</span>
                  <span className="hud-val">{zoom}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── ANALYTICS VIEW ── */}
        {activeView==='analytics' && (
          <div className="full-view">
            <div className="view-container">
              <h1 className="view-heading">Analytics</h1>
              <p className="view-sub">Overview of your Areas of Interest</p>

              <div className="stats-grid">
                <StatCard label="Total" value={features.length} color="#3b8beb" emoji="◈" />
                <StatCard label="Polygons" value={features.filter(f=>f.type==='polygon').length} color="#3b8beb" emoji="⬡" />
                <StatCard label="Rectangles" value={features.filter(f=>f.type==='rectangle').length} color="#00e5a0" emoji="▭" />
                <StatCard label="Circles" value={features.filter(f=>f.type==='circle').length} color="#9d6bff" emoji="◯" />
                <StatCard label="Markers" value={features.filter(f=>f.type==='marker').length} color="#ff4d6a" emoji="◎" />
              </div>

              <div className="area-grid">
                <div className="area-card" style={{'--c':'#3b8beb'} as React.CSSProperties}>
                  <div className="area-card-label">Total Coverage</div>
                  <div className="area-card-val" style={{color:'#3b8beb'}}>{totalArea>0?fmtArea(totalArea):'—'}</div>
                  <div className="area-card-desc">Sum of all feature areas</div>
                </div>
                <div className="area-card" style={{'--c':'#00e5a0'} as React.CSSProperties}>
                  <div className="area-card-label">Average Area</div>
                  <div className="area-card-val" style={{color:'#00e5a0'}}>{avgArea>0?fmtArea(avgArea):'—'}</div>
                  <div className="area-card-desc">Mean area per feature</div>
                </div>
              </div>

              <div className="recent-card">
                <div className="recent-head">Recent Features</div>
                {features.length===0 ? (
                  <div className="empty-state">No features yet — draw some AOIs on the map.</div>
                ) : features.slice(0,12).map(f=>(
                  <div key={f.id} className="recent-row">
                    <div className="recent-left">
                      <div className="recent-dot-col" style={{background:f.color, boxShadow:`0 0 6px ${f.color}`}} />
                      <div>
                        <div className="recent-name">{f.name}</div>
                        <div className="recent-type">{f.type}</div>
                      </div>
                    </div>
                    <div className="recent-right">
                      <div className="recent-area">{f.area?fmtArea(f.area):'N/A'}</div>
                      <div className="recent-date">{new Date(f.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS VIEW ── */}
        {activeView==='settings' && (
          <div className="full-view">
            <div className="view-container">
              <h1 className="view-heading">Settings</h1>
              <p className="view-sub">Application preferences</p>

              <div className="settings-block">
                <div className="settings-block-head">General</div>
                {[
                  { key:'notifs',   label:'Notifications', desc:'Receive in-app notifications' },
                  { key:'autoSave', label:'Auto-save',      desc:'Persist features to localStorage' },
                  { key:'coords',   label:'Show Coords',    desc:'Display cursor coordinates on map' },
                ].map(s=>(
                  <div key={s.key} className="settings-row">
                    <div className="settings-info">
                      <h3>{s.label}</h3>
                      <p>{s.desc}</p>
                    </div>
                    <Toggle
                      checked={settings[s.key as keyof typeof settings] as boolean}
                      onChange={v=>setSettings(p=>({...p,[s.key]:v}))}
                    />
                  </div>
                ))}
              </div>

              <div className="settings-block">
                <div className="settings-block-head">Map</div>
                <div className="settings-row">
                  <div className="settings-info"><h3>Default Zoom</h3><p>Initial zoom level on load</p></div>
                  <select className="select-input" value={settings.defaultZoom}
                    onChange={e=>setSettings(p=>({...p,defaultZoom:+e.target.value}))}>
                    {[3,4,5,6,8,10,12].map(z=><option key={z} value={z}>Zoom {z}</option>)}
                  </select>
                </div>
                <div className="settings-row">
                  <div className="settings-info"><h3>Language</h3><p>UI language</p></div>
                  <select className="select-input" value={settings.lang}
                    onChange={e=>setSettings(p=>({...p,lang:e.target.value}))}>
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
                  <div className="settings-info danger"><h3>Clear All Data</h3><p>Remove all features and settings</p></div>
                  <button className="btn-danger" style={{flex:'none',padding:'7px 16px'}} onClick={()=>{
                    if(confirm('Delete everything?')){ localStorage.clear(); window.location.reload() }
                  }}>Clear</button>
                </div>
              </div>

              <div className="settings-actions">
                <button className="btn-secondary-sm" onClick={()=>setActiveView('map')}>Cancel</button>
                <button className="btn-primary" onClick={()=>{ localStorage.setItem('app-settings',JSON.stringify(settings)); toast('Settings saved','success') }}>
                  Save Settings
                </button>
              </div>
              <div className="settings-footer">AOIstudio v2.0 · React + TypeScript + Leaflet</div>
            </div>
          </div>
        )}

        {/* ── NOTIFICATION PANEL ── */}
        {showNotifs && (
          <>
            <div className="panel-backdrop" onClick={()=>setShowNotifs(false)} />
            <div className="notif-panel">
              <div className="panel-header">
                <span className="panel-title">Notifications</span>
                <div className="panel-actions">
                  {notifications.length>0 && (
                    <button className="clear-link" onClick={()=>{ setNotifications([]); toast('Cleared','info') }}>clear all</button>
                  )}
                  <button className="close-btn" onClick={()=>setShowNotifs(false)}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div className="notif-list">
                {notifications.length===0 ? (
                  <div className="notif-empty">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                    </svg>
                    <p>All caught up</p>
                  </div>
                ) : notifications.map((n,i)=>(
                  <NotifItem key={n.id} n={n} index={i}
                    onClick={()=>setNotifications(p=>p.map(x=>x.id===n.id?{...x,read:true}:x))} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── PROFILE POPUP ── */}
        {showProfile && (
          <>
            <div className="panel-backdrop" onClick={()=>setShowProfile(false)} />
            <div className="profile-popup">
              <div className="profile-top">
                <div className="profile-avatar-lg">JD</div>
                <div>
                  <div className="profile-name">John Doe</div>
                  <div className="profile-email">john@example.com</div>
                </div>
              </div>
              <div className="profile-menu">
                {[
                  { label:'My Profile', icon:'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
                  { label:'Settings',   icon:'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
                  { label:'Help',       icon:'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                ].map(item=>(
                  <button key={item.label} className="profile-item"
                    onClick={()=>{ toast(`${item.label} coming soon`,'info'); setShowProfile(false) }}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon}/>
                    </svg>
                    {item.label}
                  </button>
                ))}
                <div className="profile-sep" />
                <button className="profile-item logout" onClick={()=>{ toast('Signed out','success'); setShowProfile(false) }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── TOASTS — Lightswind animated notification stack ── */}
      <div className="toast-stack">
        {toasts.map(t=>(
          <div key={t.id} className={`toast ${t.type}`} onClick={()=>setToasts(p=>p.filter(x=>x.id!==t.id))}>
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {t.type==='success' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>}
              {t.type==='error'   && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>}
              {t.type==='info'    && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>}
              {t.type==='warning' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>}
            </svg>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}
