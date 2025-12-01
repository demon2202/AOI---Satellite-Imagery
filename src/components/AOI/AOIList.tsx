import { useState } from 'react'
import { formatArea, getFeatureBounds } from '../../utils/mapUtils'
import type { AOIListProps, AOIFeature, FeatureType } from '../../types'

const featureIcons: Record<FeatureType, { path: string; color: string }> = {
  polygon: {
    path: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z',
    color: 'text-blue-400'
  },
  rectangle: {
    path: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z',
    color: 'text-green-400'
  },
  circle: {
    path: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0',
    color: 'text-purple-400'
  },
  marker: {
    path: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
    color: 'text-red-400'
  }
}

function FeatureIcon({ type }: { type: FeatureType }) {
  const { path, color } = featureIcons[type]
  return (
    <svg className={`w-4 h-4 ${color}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
    </svg>
  )
}

function AOIItem({
  feature,
  onRemove,
  onUpdate,
  onZoom
}: {
  feature: AOIFeature
  onRemove: () => void
  onUpdate: (updates: Partial<AOIFeature>) => void
  onZoom: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(feature.name)

  const handleSaveName = () => {
    onUpdate({ name })
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName()
    }
    if (e.key === 'Escape') {
      setName(feature.name)
      setIsEditing(false)
    }
  }

  return (
    <div className="aoi-item bg-slate-700/50 rounded-lg p-3" data-testid={`aoi-item-${feature.id}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-8 h-8 rounded flex items-center justify-center"
            style={{ background: `${feature.color}20` }}
          >
            <FeatureIcon type={feature.type} />
          </div>
          <div>
            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={handleKeyDown}
                autoFocus
                className="bg-slate-600 text-sm font-medium text-white border border-slate-500 rounded px-2 py-1 focus:outline-none focus:border-blue-500 w-32"
              />
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm font-medium text-white hover:text-blue-400 transition-colors text-left"
              >
                {feature.name}
              </button>
            )}
            <p className="text-xs text-slate-400 mt-0.5">
              {feature.type}
              {feature.area && ` • ${formatArea(feature.area)}`}
            </p>
          </div>
        </div>
        
        <div className="flex gap-1">
          <button
            onClick={onZoom}
            className="p-1.5 hover:bg-slate-600 rounded transition-colors"
            title="Zoom to feature"
            aria-label="Zoom to feature"
          >
            <svg className="w-4 h-4 text-slate-400 hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
          <button
            onClick={onRemove}
            className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
            title="Delete feature"
            aria-label="Delete feature"
          >
            <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AOIList({
  features,
  onFeatureRemove,
  onFeatureUpdate,
  onExport,
  mapRef
}: AOIListProps) {
  const handleZoomToFeature = (feature: AOIFeature) => {
    if (!mapRef) return

    const bounds = getFeatureBounds(feature)
    if (bounds) {
      if (feature.type === 'marker') {
        const coords = feature.coordinates as number[]
        mapRef.setView([coords[0], coords[1]], 15)
      } else {
        mapRef.fitBounds(bounds, { padding: [50, 50] })
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Areas of Interest
          </h3>
          <button
            onClick={onExport}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            data-testid="export-btn"
          >
            Export GeoJSON
          </button>
        </div>
      </div>

      {/* Feature List */}
      <div 
        className="flex-1 overflow-y-auto px-4 pb-4 space-y-2"
        data-testid="aoi-list"
      >
        {features.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-sm">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
            </svg>
            <p>No areas defined yet</p>
            <p className="text-xs mt-1">Use drawing tools to create AOI</p>
          </div>
        ) : (
          features.map(feature => (
            <AOIItem
              key={feature.id}
              feature={feature}
              onRemove={() => onFeatureRemove(feature.id)}
              onUpdate={(updates) => onFeatureUpdate(feature.id, updates)}
              onZoom={() => handleZoomToFeature(feature)}
            />
          ))
        )}
      </div>
    </div>
  )
}