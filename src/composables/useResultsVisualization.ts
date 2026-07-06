import { watch, shallowRef } from 'vue'
import type { ShallowRef } from 'vue'
import * as THREE from 'three'
import { useOptimization } from '@/composables/useOptimization'
import { STLLoader } from 'three/examples/jsm/Addons.js'

export function useResultsVisualization(
  scene: ShallowRef<THREE.Scene | null>,
  camera: ShallowRef<THREE.Camera | null>,
  renderer: ShallowRef<THREE.WebGLRenderer | null>,
  optimizer: ReturnType<typeof useOptimization>,
) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  const stlMesh = shallowRef<THREE.Mesh | null>(null)

  watch(optimizer.latestStlData, (stlBuffer) => {
    clear()
    if (!stlBuffer || !scene?.value) return
    const geometry = new STLLoader().parse(stlBuffer)
    //fixOrientation(geometry)
    const mesh = new THREE.Mesh(geometry, material.clone())
    mesh.geometry.translate(0.5, 0.5, 0.5) //correct for voxel position?
    stlMesh.value = mesh
    scene.value.add(mesh)
  })

  function clear() {
    const mesh = stlMesh.value
    if (!mesh) return

    console.log('clearing')

    if (mesh.parent) {
      mesh.parent.remove(mesh)
    } else if (scene?.value) {
      scene.value.remove(mesh)
    }
    mesh.geometry?.dispose()
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((material) => material.dispose())
    } else {
      mesh.material?.dispose()
    }

    stlMesh.value = null
    if (renderer?.value && scene?.value && camera?.value)
      renderer?.value.render(scene.value, camera.value)
  }

  return { stlMesh, clear }
}
