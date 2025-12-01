import type { DrawingToolsProps } from '../../types'

const tools = [
  {
    id: 'polygon',
    name: 'Polygon',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"/>
      </svg>
    )
  },
  {
    id: 'rectangle',
    name: 'Rectangle',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"/>
      </svg>
    )
  },
  {
    id: 'circle',
    name: 'Circle',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}/>
      </svg>
    )
  },
  {
    id: 'marker',
    name: 'Marker',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
      </svg>
    )
  }
]

export default function DrawingTools({ activeTool, onToolChange, onClearAll }: DrawingToolsProps) {
  const handleToolClick = (toolId: string) => {
    if (activeTool === toolId) {
      onToolChange(null)
    } else {
      onToolChange(toolId)
    }
  }

  return (
    <div className="p-4 border-b border-slate-700">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        Drawing Tools
      </h3>
      
      <div className="grid grid-cols-4 gap-2">
        {tools.map(tool => (
          <button
            key={tool.id}
            onClick={() => handleToolClick(tool.id)}
            className={`map-control-btn p-3 rounded-lg flex flex-col items-center gap-1 group transition-all ${
              activeTool === tool.id 
                ? 'tool-active text-white pulse-ring' 
                : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
            }`}
            title={`Draw ${tool.name}`}
            aria-label={`Draw ${tool.name}`}
            aria-pressed={activeTool === tool.id}
            data-testid={`draw-${tool.id}-btn`}
          >
            {tool.icon}
            <span className="text-[10px]">{tool.name}</span>
          </button>
        ))}
      </div>
      
      <div className="flex gap-2 mt-3">
        {activeTool && (
          <button
            onClick={() => onToolChange(null)}
            className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-slate-300 transition-colors"
            data-testid="cancel-draw-btn"
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => {
            if (confirm('Are you sure you want to clear all areas of interest?')) {
              onClearAll()
            }
          }}
          className="flex-1 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition-colors"
          data-testid="clear-all-btn"
        >
          Clear All
        </button>
      </div>
    </div>
  )
}