import DrawingTools from '../Map/DrawingTools'
import LayerManager from '../Map/LayerManager'
import AOIList from '../AOI/AOIList'
import type { SidebarProps } from '../../types'

export default function Sidebar({
  features,
  activeTool,
  wmsVisible,
  aoiVisible,
  wmsOpacity,
  onToolChange,
  onWmsToggle,
  onAoiToggle,
  onOpacityChange,
  onFeatureRemove,
  onFeatureUpdate,
  onClearAll,
  onExport,
  mapRef
}: SidebarProps) {
  return (
    <aside className="w-80 bg-slate-800 border-r border-slate-700 flex flex-col" data-testid="sidebar">
      {/* Drawing Tools */}
      <DrawingTools
        activeTool={activeTool}
        onToolChange={onToolChange}
        onClearAll={onClearAll}
      />
      
      {/* Layer Management */}
      <LayerManager
        wmsVisible={wmsVisible}
        aoiVisible={aoiVisible}
        wmsOpacity={wmsOpacity}
        featureCount={features.length}
        onWmsToggle={onWmsToggle}
        onAoiToggle={onAoiToggle}
        onOpacityChange={onOpacityChange}
      />
      
      {/* AOI List */}
      <AOIList
        features={features}
        onFeatureRemove={onFeatureRemove}
        onFeatureUpdate={onFeatureUpdate}
        onExport={onExport}
        mapRef={mapRef}
      />
    </aside>
  )
}