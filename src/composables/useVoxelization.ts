import { ref } from 'vue'
import VoxelWorker from '@/workers/voxelWorker?worker'

export function useVoxelization() {
  const isLoading = ref(false)
  const obstacleMask = ref<Uint8Array | null>(null)
  const supportMask = ref<Uint8Array | null>(null)
  const forcePoints = ref<
    Array<{
      index: number
      vector: [number, number, number]
    }>
  >([])

  const voxelize = async (
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
    isLoading.value = true
    const worker = new VoxelWorker()
    worker.postMessage({ gridSize, worldMin, worldMax, objects })

    return new Promise((resolve) => {
      worker.onmessage = (e) => {
        obstacleMask.value = e.data.obstacleMask
        supportMask.value = e.data.supportMask
        forcePoints.value = e.data.forcePoints
        worker.terminate()
        isLoading.value = false
        resolve()
      }
    })
  }

  return { isLoading, obstacleMask, supportMask, forcePoints, voxelize }
}
