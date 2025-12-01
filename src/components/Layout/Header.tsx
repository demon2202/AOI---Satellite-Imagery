import SearchBar from '../Search/SearchBar'
import type { ViewType } from '../../App'

interface HeaderProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
  unreadCount: number
  onNotificationClick: () => void
  onProfileClick: () => void
  mapRef?: L.Map | null
}

export default function Header({ 
  activeView, 
  onViewChange, 
  unreadCount,
  onNotificationClick,
  onProfileClick,
  mapRef 
}: HeaderProps) {
  const navItems: { id: ViewType; label: string }[] = [
    { id: 'map', label: 'Map View' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-50">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <span className="font-semibold text-lg">AOI Creation</span>
        </div>
        
        <div className="h-6 w-px bg-slate-600" />
        
        {/* Navigation */}
        <nav className="flex gap-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                activeView === item.id
                  ? 'text-blue-400 bg-blue-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Search Bar - Only show on map view */}
      {activeView === 'map' && <SearchBar mapRef={mapRef || null} />}
      
      {/* Spacer for non-map views */}
      {activeView !== 'map' && <div className="flex-1" />}
      
      {/* User Menu */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button 
          onClick={onNotificationClick}
          className="relative p-2 hover:bg-slate-700 rounded-lg transition-colors" 
          title="Notifications"
          aria-label="Notifications"
        >
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Profile */}
        <button
          onClick={onProfileClick}
          className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-sm font-medium hover:ring-2 hover:ring-blue-400 transition-all cursor-pointer"
          title="Profile"
          aria-label="Profile menu"
        >
          JD
        </button>
      </div>
    </header>
  )
}