import { watch, shallowRef } from 'vue'
import type { ShallowRef } from 'vue'
import * as THREE from 'three'
import { useWebsocket } from '@/composables/useWebsocket'
import { STLLoader } from 'three/examples/jsm/Addons.js'

export function useResultsVisualization(
  scene: ShallowRef<THREE.Scene | null>,
  camera: ShallowRef<THREE.Camera | null>,
  renderer: ShallowRef<THREE.WebGLRenderer | null>,
  websocket: ReturnType<typeof useWebsocket>,
) {
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  const stlMesh = shallowRef<THREE.Mesh | null>(null)

  watch(websocket.latestStlData, (stlBuffer) => {
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

  function showHideResults(show: boolean) {
    if (!stlMesh.value) return
    stlMesh.value.visible = show
  }

  return { stlMesh, clear, showHideResults }
}
