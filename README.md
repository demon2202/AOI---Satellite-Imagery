# AOI Creation - Satellite Imagery Application

A modern, interactive web application for creating and managing Areas of Interest (AOI) on satellite imagery. Built with React, TypeScript, Vite, and Leaflet.


## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run Playwright tests
npm run test

# Run tests with UI
npm run test:ui

# Build for production
npm run build
```

The application will be available at `http://localhost:3000`

## 📋 Environment Variables

Copy `.env.example` to `.env` and configure as needed:

```env
VITE_WMS_URL=https://www.wms.nrw.de/geobasis/wms_nw_dop
VITE_WMS_LAYER=nw_dop_rgb
VITE_DEFAULT_LAT=51.4556
VITE_DEFAULT_LNG=7.0116
VITE_DEFAULT_ZOOM=12
VITE_NOMINATIM_URL=https://nominatim.openstreetmap.org
```

## 🗺️ Map Library Choice

### Selected: Leaflet.js

**Why Leaflet?**

1. **Lightweight & Fast**: At ~42KB gzipped, Leaflet is significantly smaller than alternatives like OpenLayers (~170KB) or MapLibre GL JS (~200KB), resulting in faster load times.

2. **Excellent WMS Support**: Native `L.tileLayer.wms()` with full WMS parameter support, perfect for the NRW satellite imagery requirement.

3. **Mature Drawing Library**: `leaflet-draw` provides production-ready drawing tools with excellent UX, reducing development time significantly.

4. **Wide Adoption**: Largest community among open-source mapping libraries, extensive documentation, and countless plugins.

5. **Simple API**: Intuitive, chainable API that's easy to learn and maintain.

**Alternatives Considered:**

| Library | Pros | Cons | Reason Not Chosen |
|---------|------|------|-------------------|
| **OpenLayers** | Feature-rich, excellent projections | Larger bundle, steeper learning curve | Overkill for this use case |
| **MapLibre GL JS** | Vector tiles, 3D support, smooth animations | No native drawing tools, larger bundle | WebGL overhead unnecessary |
| **react-map-gl** | React-native integration | Mapbox-focused, less WMS support | Less suitable for WMS-heavy apps |

## 🏗️ Architecture Decisions

### Project Structure

```
src/
├── components/          # React components organized by feature
│   ├── Map/            # Map-related components
│   ├── Layout/         # Header, Sidebar, structural components
│   ├── Search/         # Search functionality
│   ├── AOI/            # AOI list and management
│   └── UI/             # Reusable UI components
├── hooks/              # Custom React hooks
├── types/              # TypeScript type definitions
├── utils/              # Utility functions
└── App.tsx             # Main application component
```

### State Management

**Approach: React useState + Custom Hooks**

For an application of this scale, React's built-in state management is sufficient. The state is:

1. **Centralized in App.tsx**: Single source of truth for features, UI state, and map reference
2. **Passed via Props**: Clear data flow makes debugging easier
3. **Persisted with useLocalStorage**: Custom hook handles localStorage with proper serialization

**Why not Redux/Zustand?**
- Adds complexity without proportional benefit
- Application state is relatively simple
- No complex async state management needed

### Component Design Principles

1. **Single Responsibility**: Each component has one clear purpose
2. **Props-based Configuration**: Components are configurable via props
3. **Controlled Components**: Form elements are controlled for predictable behavior
4. **Data-testid Attributes**: Every interactive element has test identifiers

## ⚡ Performance Considerations

### Current Optimizations

1. **Debounced Search**: 300ms debounce on search input prevents excessive API calls
2. **useCallback/useMemo**: Event handlers and computed values are memoized
3. **Lazy Layer Updates**: WMS opacity changes are applied directly without re-rendering
4. **Feature Group**: All drawn items in a single FeatureGroup for efficient layer management

### Handling 1000s of Points/Polygons

For production with thousands of features, implement:

```typescript
// 1. Canvas Renderer for better performance
const map = L.map('map', {
  preferCanvas: true,
  renderer: L.canvas()
})

// 2. Marker Clustering
import 'leaflet.markercluster'
const markers = L.markerClusterGroup({
  chunkedLoading: true,
  maxClusterRadius: 50
})

// 3. Viewport-based Rendering (Virtual Scrolling)
function getVisibleFeatures(features, bounds) {
  return features.filter(f => bounds.intersects(getFeatureBounds(f)))
}

// 4. Web Workers for Heavy Calculations
const worker = new Worker('areaCalculation.worker.js')
worker.postMessage({ type: 'calculateAreas', features })

// 5. Simplification for Complex Polygons
import simplify from 'simplify-js'
const simplified = simplify(points, tolerance, highQuality)
```

### Recommended Production Enhancements

1. **Tile Caching**: Use service workers to cache WMS tiles
2. **Spatial Indexing**: R-tree for fast spatial queries
3. **Progressive Loading**: Load features in chunks as user pans
4. **WebGL Rendering**: Switch to MapLibre for 10,000+ features

## 🧪 Testing Strategy

### What Was Tested

**E2E Tests (Playwright):**

1. **map.spec.ts** - Core map functionality
   - Map loads successfully
   - Zoom controls work
   - Reset view functionality
   - Coordinate display
   - Layer toggle/opacity

2. **drawing.spec.ts** - Drawing tools
   - Tool visibility
   - Activation/deactivation
   - Tool switching
   - Empty state display

3. **search.spec.ts** - Search functionality
   - Input visibility
   - Debounce behavior
   - Keyboard interactions

### Why These Tests?

- **Critical User Paths**: Focus on features users interact with most
- **Integration Points**: Test where components interact (map + controls)
- **Edge Cases**: Empty states, keyboard navigation, API failures

### Future Testing (With More Time)

```typescript
// Unit tests for utilities
describe('mapUtils', () => {
  it('should calculate polygon area correctly')
  it('should format coordinates properly')
  it('should generate unique IDs')
})

// Component tests with React Testing Library
describe('DrawingTools', () => {
  it('should highlight active tool')
  it('should call onToolChange when clicked')
})

// Visual regression tests
describe('Visual', () => {
  it('should match sidebar snapshot')
  it('should match map controls snapshot')
})
```

## ⚖️ Tradeoffs Made

| Decision | Tradeoff | Reasoning |
|----------|----------|-----------|
| **Leaflet over MapLibre** | No vector tile support | WMS is the primary requirement; Leaflet is simpler |
| **localStorage over IndexedDB** | 5MB limit | Sufficient for typical AOI use; simpler API |
| **Props over Context** | Prop drilling | Clear data flow; easier to test and debug |
| **No state library** | Manual state management | App complexity doesn't warrant extra dependency |
| **CSS-in-JS via Tailwind** | No CSS modules | Faster development; consistent design system |
| **Inline SVG icons** | Slightly larger bundle | No icon library dependency; customizable |

## 🚢 Production Readiness

### Current State

✅ TypeScript with strict mode  
✅ Error boundaries (partial)  
✅ Responsive design  
✅ Accessibility attributes  
✅ E2E test coverage  
✅ localStorage persistence  

### Recommended Additions

```typescript
// 1. Error Boundary Component
class MapErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    logErrorToService(error, info)
  }
}

// 2. Request Retry Logic
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetch(url)
    } catch (e) {
      if (i === retries - 1) throw e
      await delay(1000 * Math.pow(2, i))
    }
  }
}

// 3. Feature Flags
const features = {
  enableAdvancedDrawing: process.env.VITE_ENABLE_ADVANCED,
  maxFeatures: parseInt(process.env.VITE_MAX_FEATURES)
}

// 4. Analytics Integration
function trackEvent(action, category, label) {
  gtag('event', action, { category, label })
}
```

### Deployment Checklist

- [ ] Set up CI/CD pipeline
- [ ] Configure CDN for static assets
- [ ] Set up error monitoring (Sentry)
- [ ] Add performance monitoring
- [ ] Configure CORS for WMS proxy
- [ ] Set up health checks
- [ ] Add rate limiting for geocoding

## ⏱️ Time Spent

| Task | Time |
|------|------|
| Project setup (Vite, TS, Tailwind) | 30 min |
| Map integration & WMS layer | 45 min |
| Drawing tools implementation | 1.5 hours |
| UI components (Sidebar, Header) | 1 hour |
| Search with geocoding | 30 min |
| Layer management | 30 min |
| localStorage persistence | 30 min |
| Playwright tests | 1 hour |
| Documentation | 45 min |
| **Total** | **~7 hours** |

## 📚 API Documentation

### Geocoding (Nominatim)

```
GET https://nominatim.openstreetmap.org/search

Query Parameters:
- q: Search query (string)
- format: Response format ("json")
- limit: Max results (number)

Response:
[
  {
    "place_id": 123456,
    "lat": "51.4556",
    "lon": "7.0116",
    "display_name": "Essen, NRW, Germany",
    "type": "city"
  }
]
```

### WMS Layer (NRW)

```
GET https://www.wms.nrw.de/geobasis/wms_nw_dop

WMS Parameters:
- SERVICE: WMS
- VERSION: 1.3.0
- REQUEST: GetMap
- LAYERS: nw_dop_rgb
- FORMAT: image/png
- CRS: EPSG:3857
- BBOX: {bounds}
- WIDTH: 256
- HEIGHT: 256
```

## 🔧 Data Schema

### AOI Feature

```typescript
interface AOIFeature {
  id: string           // Unique identifier
  name: string         // User-defined name
  type: FeatureType    // 'polygon' | 'rectangle' | 'circle' | 'marker'
  coordinates: Coords  // GeoJSON-compatible coordinates
  area?: number        // Calculated area in m²
  color: string        // Hex color code
  createdAt: string    // ISO 8601 timestamp
}
```

### GeoJSON Export

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "id": "abc123",
        "name": "AOI 1",
        "type": "polygon",
        "area": 15000,
        "createdAt": "2024-01-15T10:30:00Z"
      },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[7.01, 51.45], [7.02, 51.45], [7.02, 51.46], [7.01, 51.46], [7.01, 51.45]]]
      }
    }
  ]
}
```
#   A O I - - - S a t e l l i t e - I m a g e r y  
 