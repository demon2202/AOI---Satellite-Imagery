import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import type { AOIFeature } from '../types/index';

interface MapStore {
  center: [number, number];
  zoom: number;
  layers: {
    wms: boolean;
    drawing: boolean;
    features: boolean;
  };
  features: AOIFeature[];
  selectedFeature: AOIFeature | null;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  toggleLayer: (layer: keyof MapStore['layers']) => void;
  addFeature: (feature: AOIFeature) => void;
  removeFeature: (id: string) => void;
  updateFeature: (id: string, feature: Partial<AOIFeature>) => void;
  setSelectedFeature: (feature: AOIFeature | null) => void;
  clearFeatures: () => void;
}

export const useMapStore = create<MapStore>()(
  devtools(
    persist(
      (set) => ({
        center: [20.5937, 78.9629],
        zoom: 5,
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
