import { useState, useEffect, useRef } from 'react'
import { useDebounce } from '../../hooks/useDebounce'
import { MAP_CONFIG } from '../../utils/mapUtils'
import type { SearchBarProps, SearchResult } from '../../types'

export default function SearchBar({ mapRef }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const debouncedQuery = useDebounce(query, 300)

  // Fetch search results
  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }

    const fetchResults = async () => {
      setIsLoading(true)
      try {
        const response = await fetch(
          `${MAP_CONFIG.NOMINATIM_URL}/search?format=json&q=${encodeURIComponent(debouncedQuery)}&limit=5`
        )
        const data = await response.json()
        setResults(data)
        setIsOpen(data.length > 0)
      } catch (error) {
        console.error('Search error:', error)
        setResults([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchResults()
  }, [debouncedQuery])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (result: SearchResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    
    if (mapRef) {
      mapRef.setView([lat, lng], 14)
    }
    
    setQuery(result.display_name.split(',')[0])
    setIsOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && results.length > 0) {
      handleSelect(results[0])
    }
    if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  return (
    <div className="relative w-96" ref={containerRef}>
      <div className="relative">
        <svg 
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder="Search location..."
          className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          data-testid="search-input"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div 
          className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-50"
          data-testid="search-results"
        >
          {results.map((result) => (
            <div
              key={result.place_id}
              onClick={() => handleSelect(result)}
              className="search-result p-3 cursor-pointer border-b border-slate-700 last:border-b-0 hover:bg-slate-700/50"
            >
              <p className="text-sm font-medium text-white">
                {result.display_name.split(',')[0]}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {result.display_name}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {isOpen && results.length === 0 && debouncedQuery.length >= 3 && !isLoading && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 z-50">
          <p className="text-sm text-slate-400">No results found</p>
        </div>
      )}
    </div>
  )
}