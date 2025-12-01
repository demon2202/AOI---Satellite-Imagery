import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type { Feature } from '../types';

interface MapStore {
  center: [number, number];
  zoom: number;
  layers: {
    wms: boolean;
    drawing: boolean;
    features: boolean;
  };
  features: Feature[];
  selectedFeature: Feature | null;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  toggleLayer: (layer: keyof MapStore['layers']) => void;
  addFeature: (feature: Feature) => void;
  removeFeature: (id: string) => void;
  updateFeature: (id: string, feature: Partial<Feature>) => void;
  setSelectedFeature: (feature: Feature | null) => void;
  clearFeatures: () => void;
}

export const useMapStore = create<MapStore>()(
  devtools(
    persist(
      (set) => ({
        center: [51.5074, 7.4912],
        zoom: 10,
        layers: {
          wms: true,
          drawing: false,
          features: true,
        },
        features: [],
        selectedFeature: null,
        setCenter: (center) => set({ center }),
        setZoom: (zoom) => set({ zoom }),
        toggleLayer: (layer) =>
          set((state) => ({
            layers: {
              ...state.layers,
              [layer]: !state.layers[layer],
            },
          })),
        addFeature: (feature) =>
          set((state) => ({ features: [...state.features, feature] })),
        removeFeature: (id) =>
          set((state) => ({
            features: state.features.filter((f) => f.id !== id),
          })),
        updateFeature: (id, updates) =>
          set((state) => ({
            features: state.features.map((f) =>
              f.id === id ? { ...f, ...updates } : f
            ),
          })),
        setSelectedFeature: (feature) => set({ selectedFeature: feature }),
        clearFeatures: () => set({ features: [] }),
      }),
      {
        name: 'map-storage',
      }
    )
  )
);