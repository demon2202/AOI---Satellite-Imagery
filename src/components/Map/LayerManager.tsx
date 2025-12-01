import type { LayerManagerProps } from '../../types'

export default function LayerManager({
  wmsVisible,
  aoiVisible,
  wmsOpacity,
  featureCount,
  onWmsToggle,
  onAoiToggle,
  onOpacityChange
}: LayerManagerProps) {
  return (
    <div className="p-4 border-b border-slate-700">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Layers
      </h3>
      
      <div className="space-y-2">
        {/* WMS Layer Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-blue-500 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium">Base Map</p>
              <p className="text-xs text-slate-400">OpenStreetMap</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={wmsVisible}
              onChange={(e) => onWmsToggle(e.target.checked)}
              className="sr-only peer"
              data-testid="wms-toggle"
            />
            <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500" />
          </label>
        </div>

        {/* AOI Features Toggle */}
        <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium">AOI Features</p>
              <p className="text-xs text-slate-400" data-testid="feature-count">
                {featureCount} feature{featureCount !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={aoiVisible}
              onChange={(e) => onAoiToggle(e.target.checked)}
              className="sr-only peer"
              data-testid="aoi-toggle"
            />
            <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500" />
          </label>
        </div>

        {/* Opacity Slider */}
        <div className="p-3 bg-slate-700/50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-300">WMS Opacity</span>
            <span className="text-xs text-slate-400" data-testid="opacity-value">{wmsOpacity}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={wmsOpacity}
            onChange={(e) => onOpacityChange(parseInt(e.target.value))}
            className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            data-testid="opacity-slider"
          />
        </div>
      </div>
    </div>
  )
}