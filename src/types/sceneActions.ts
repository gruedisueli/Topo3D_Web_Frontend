import type { EditorObject, PrimitiveType } from './editor'
import * as THREE from 'three'
//add, remove, transform, change primitive, change force magnitude, change force direction
export type ActionType = 'add' | 'remove' | 'primitive' | 'transform' | 'magnitude' | 'direction'
export interface SceneAction {
  type: ActionType
  id: string
  data?:
    | EditorObject
    | [PrimitiveType, PrimitiveType]
    | [ObjectTransformState, ObjectTransformState]
    | [ObjectForceState, ObjectForceState]
    | [number, number]
}

export interface ObjectTransformState {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  scale: THREE.Vector3
}

export interface ObjectForceState {
  arrowQuaternion: THREE.Quaternion
  force: THREE.Vector3
}
