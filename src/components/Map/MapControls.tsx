import { useState, useCallback } from 'react'
import { MAP_CONFIG } from '../../utils/mapUtils'
import type { MapControlsProps } from '../../types'

export default function MapControls({ mapRef, showToast }: MapControlsProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)

  const handleZoomIn = useCallback(() => {
    mapRef?.zoomIn()
  }, [mapRef])

  const handleZoomOut = useCallback(() => {
    mapRef?.zoomOut()
  }, [mapRef])

  const handleResetView = useCallback(() => {
    mapRef?.setView(MAP_CONFIG.DEFAULT_CENTER, MAP_CONFIG.DEFAULT_ZOOM)
  }, [mapRef])

  const handleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported', 'error')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        mapRef?.setView([latitude, longitude], 15)
        showToast('Location found', 'success')
      },
      () => {
        showToast('Could not get your location', 'error')
      }
    )
  }, [mapRef, showToast])

  const buttonClass = "map-control-btn w-10 h-10 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg flex items-center justify-center shadow-lg transition-colors"

  return (
    <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
      <button
        className={buttonClass}
        onClick={handleZoomIn}
        title="Zoom In"
        aria-label="Zoom In"
        data-testid="zoom-in-btn"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
      
      <button
        className={buttonClass}
        onClick={handleZoomOut}
        title="Zoom Out"
        aria-label="Zoom Out"
        data-testid="zoom-out-btn"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
        </svg>
      </button>

      <div className="h-px bg-slate-600 mx-2" />

      <button
        className={buttonClass}
        onClick={handleFullscreen}
        title="Toggle Fullscreen"
        aria-label="Toggle Fullscreen"
        data-testid="fullscreen-btn"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isFullscreen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          )}
        </svg>
      </button>

      <button
        className={buttonClass}
        onClick={handleResetView}
        title="Reset View"
        aria-label="Reset View"
        data-testid="reset-view-btn"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </button>

      <button
        className={buttonClass}
        onClick={handleLocate}
        title="My Location"
        aria-label="My Location"
        data-testid="locate-btn"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  )
}