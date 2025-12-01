import type { AOIFeature } from '../../types'
import { formatArea } from '../../utils/mapUtils'

interface AnalyticsViewProps {
  features: AOIFeature[]
}

export default function AnalyticsView({ features }: AnalyticsViewProps) {
  // Calculate statistics
  const totalFeatures = features.length
  const polygons = features.filter(f => f.type === 'polygon').length
  const rectangles = features.filter(f => f.type === 'rectangle').length
  const circles = features.filter(f => f.type === 'circle').length
  const markers = features.filter(f => f.type === 'marker').length
  
  const totalArea = features.reduce((sum, f) => sum + (f.area || 0), 0)
  const featuresWithArea = features.filter(f => f.area)
  const avgArea = featuresWithArea.length > 0 ? totalArea / featuresWithArea.length : 0

  const stats = [
    { label: 'Total Features', value: totalFeatures, icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7', color: 'blue' },
    { label: 'Polygons', value: polygons, icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z', color: 'purple' },
    { label: 'Rectangles', value: rectangles, icon: 'M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z', color: 'green' },
    { label: 'Circles', value: circles, icon: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', color: 'yellow' },
    { label: 'Markers', value: markers, icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z', color: 'red' },
  ]

  const colorClasses: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600',
    purple: 'from-purple-500 to-purple-600',
    green: 'from-green-500 to-green-600',
    yellow: 'from-yellow-500 to-yellow-600',
    red: 'from-red-500 to-red-600',
  }

  return (
    <div className="flex-1 bg-slate-900 p-6 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Analytics Dashboard</h1>
          <p className="text-slate-400">Overview of your Areas of Interest</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="bg-slate-800 rounded-xl p-4 border border-slate-700"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[stat.color]} flex items-center justify-center`}>
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                  </svg>
                </div>
                <span className="text-slate-400 text-sm">{stat.label}</span>
              </div>
              <p className="text-3xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Area Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4">Total Area Coverage</h2>
            <p className="text-4xl font-bold text-blue-400">
              {totalArea > 0 ? formatArea(totalArea) : '0 m²'}
            </p>
            <p className="text-slate-400 mt-2 text-sm">Combined area of all features</p>
          </div>
          
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold mb-4">Average Area</h2>
            <p className="text-4xl font-bold text-green-400">
              {avgArea > 0 ? formatArea(avgArea) : '0 m²'}
            </p>
            <p className="text-slate-400 mt-2 text-sm">Average area per feature</p>
          </div>
        </div>

        {/* Recent Features */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-semibold">Recent Features</h2>
          </div>
          
          {features.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
              </svg>
              <p>No features created yet</p>
              <p className="text-sm mt-1">Go to Map View to create AOIs</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {features.slice(0, 10).map(feature => (
                <div key={feature.id} className="p-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: feature.color }}
                    />
                    <div>
                      <p className="font-medium">{feature.name}</p>
                      <p className="text-sm text-slate-400 capitalize">{feature.type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {feature.area ? formatArea(feature.area) : 'N/A'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(feature.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}