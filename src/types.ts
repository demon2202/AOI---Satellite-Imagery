export type FeatureType = 'polygon' | 'rectangle' | 'circle' | 'marker'

export interface Feature {
  id: string
  name: string
  type: FeatureType
  coordinates: number[][] | { center: number[]; radius: number } | number[]
  area?: number
  color: string
  createdAt: string
}
