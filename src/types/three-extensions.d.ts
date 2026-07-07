// this extension is to fix a known issue with "minX" not being recognized but existing
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

declare module 'three/examples/jsm/controls/TransformControls.js' {
  export interface TransformControls {
    minX?: number
    maxX?: number
    minY?: number
    maxY?: number
    minZ?: number
    maxZ?: number
  }
}
