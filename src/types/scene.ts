import type { ObjectCategory, PrimitiveType } from './editor'

export interface SavedEditorObject {
  id?: string //optional, will be regenerated
  category: ObjectCategory
  primitive: PrimitiveType
  transform: number[] //4x4 transform matrix
  forceVector?: [number, number, number]
}

export interface SavedScene {
  name: string
  description?: string
  nelx: number
  nely: number
  nelz: number
  volfrac: number
  penal: number
  rmin: number
  tolx: number
  maxloop: number
  // pitch: number
  // invert_design_space: boolean
  objects: SavedEditorObject[]
  stlFile?: string
}
