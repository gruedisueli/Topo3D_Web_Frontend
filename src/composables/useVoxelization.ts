import { ref } from 'vue'
import VoxelWorker from '@/workers/voxelWorker?worker'
import * as THREE from 'three'

export function useVoxelization() {
  let currentWorker: Worker | null = null
  let cancelCurrent = false

  const isLoading = ref(false)
  const obstacleMask = ref<Uint8Array | null>(null)
  const supportMask = ref<Uint8Array | null>(null)
  const meshMask = ref<Uint8Array | null>(null)
  const forcePoints = ref<
    Array<{
      index: number
      vector: [number, number, number]
    }>
  >([])

  const voxelizePrimitives = async (
    gridSize: [number, number, number],
    worldMin: [number, number, number],
    worldMax: [number, number, number],
    objects: Array<{
      matrixWorld: number[]
      type: string
      category: string
      forceVector?: [number, number, number]
    }>,
  ): Promise<void> => {
    if (currentWorker) {
      console.log('canceling previous voxelization job')
      cancelCurrent = true
      currentWorker.terminate()
      currentWorker = null
    }
    cancelCurrent = false
    isLoading.value = true
    const worker = new VoxelWorker()
    currentWorker = worker
    const type = 'primitives'
    worker.postMessage({ type, gridSize, worldMin, worldMax, objects })

    return new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        if (cancelCurrent) {
          //ignore result
          worker.terminate()
          reject(new Error('Cancelled'))
          return
        }
        obstacleMask.value = e.data.obstacleMask
        supportMask.value = e.data.supportMask
        forcePoints.value = e.data.forcePoints
        worker.terminate()
        isLoading.value = false
        resolve()
      }
      worker.onerror = (err) => {
        if (!cancelCurrent) reject(err)
        worker.terminate()
        currentWorker = null
      }
    })

    //alt method thread blocking, works

    //     mesh.raycast = acceleratedRaycast

    // const voxels = new Uint8Array(gridSize[0] * gridSize[1] * gridSize[2])

    // const bvh = new MeshBVH(mesh.geometry)
    // let idx = 0
    // for (let x = 0; x < gridSize[0]; x++) {
    //   for (let y = 0; y < gridSize[1]; y++) {
    //     for (let z = 0; z < gridSize[2]; z++) {
    //       const rayDirection = new THREE.Vector3(1, 0, 0) // Consistent direction
    //       const ray = new THREE.Ray(new THREE.Vector3(x, y, z), rayDirection)
    //       const intersections = bvh.raycast(ray, mesh.material, 0, 1000)
    //       voxels[idx++] = intersections.length % 2 === 0 ? 0 : 1
    //     }
    //   }
    // }
    // meshMask.value = voxels
  }

  const voxelizeMesh = async (
    gridSize: [number, number, number],
    meshGeom: THREE.Mesh,
  ): Promise<void> => {
    //console.log('usevoxelization starting to voxelize mesh')
    isLoading.value = true
    //voxelize mesh is only called infrequently and is not logged as the currentWorker
    const worker = new VoxelWorker()
    const type = 'mesh'
    const vertices = meshGeom.geometry.getAttribute('position').array as Float32Array
    const indices = meshGeom.geometry.index?.array as Uint32Array
    //console.log('usevoxelization orig mat', meshGeom.matrix)
    const matrixWorld = meshGeom.matrix.toArray() as number[]
    //console.log('usevoxelization mat arr', matrixWorld)
    const mesh = { vertices: vertices, indices: indices, matrixWorld }
    worker.postMessage({ type, gridSize, mesh })
    //console.log('use voxelization passed mesh job to worker')

    return new Promise((resolve, reject) => {
      worker.onmessage = (e) => {
        if (cancelCurrent) {
          //ignore result
          worker.terminate()
          reject(new Error('Cancelled'))
          return
        }
        meshMask.value = e.data.meshMask
        worker.terminate()
        isLoading.value = false
        resolve()
      }
      worker.onerror = (err) => {
        if (!cancelCurrent) reject(err)
        worker.terminate()
        currentWorker = null
      }
    })
  }

  function clearVoxelMasks() {
    obstacleMask.value = null
    supportMask.value = null
    forcePoints.value = []
    meshMask.value = null
  }

  return {
    isLoading,
    obstacleMask,
    supportMask,
    forcePoints,
    meshMask,
    voxelizePrimitives,
    voxelizeMesh,
    clearVoxelMasks,
  }
}
