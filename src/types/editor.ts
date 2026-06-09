import * as THREE from 'three'

export type ObjectCategory = 'support' | 'force' | 'obstacle'
export type PrimitiveType = 'cube' | 'sphere' | 'cylinder'

export interface EditorObject {
  id: string
  category: ObjectCategory
  primitive: PrimitiveType
  position: THREE.Vector3
  rotation: THREE.Euler
  scale: THREE.Vector3
  magnitude?: number
  directionRotation?: THREE.Euler
}
