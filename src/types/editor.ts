import * as THREE from 'three'

export type ObjectCategory = 'support' | 'force' | 'obstacle'
export type PrimitiveType = 'cube' | 'sphere' | 'cylinder'

export interface EditorObject {
  id: string
  category: ObjectCategory
  primitive: PrimitiveType
  transform: THREE.Matrix4
  forceVector?: THREE.Vector3 //required for force objects
}

export function cloneEditorObject(obj: EditorObject): EditorObject {
  return {
    ...obj, //safely copies primitive values
    transform: obj.transform.clone(),
    forceVector: obj.forceVector?.clone(),
  }
}
