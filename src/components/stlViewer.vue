<template>
  <div ref="containerRef" class="viewer"></div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { PropType } from 'vue'
import * as THREE from 'three'
import { useOptimization } from '@/composables/useOptimization'
import { STLLoader } from 'three/examples/jsm/Addons.js'

const { latestStlData } = useOptimization()
const material = new THREE.MeshStandardMaterial({ color: 0x3f7dbd })
const stlMesh = ref<THREE.Mesh | null>(null)

const props = defineProps({
  scene: Object as PropType<THREE.Scene | null>,
  camera: Object as PropType<THREE.PerspectiveCamera | null>,
  renderer: Object as PropType<THREE.WebGLRenderer | null>,
})

defineExpose({ clear, stlMesh })

watch(latestStlData, (stlBuffer) => {
  clear()
  if (!stlBuffer || !props.scene) return
  const geometry = new STLLoader().parse(stlBuffer)
  fixOrientation(geometry)
  const mesh = new THREE.Mesh(geometry, material)
  stlMesh.value = mesh
  props.scene.add(mesh)
})

function clear() {
  const mesh = stlMesh.value
  if (!mesh) return

  console.log('clearing')

  if (mesh.parent) {
    mesh.parent.remove(mesh)
  } else if (props.scene) {
    props.scene.remove(mesh)
  }
  mesh.geometry?.dispose()
  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => material.dispose())
  } else {
    mesh.material?.dispose()
  }

  stlMesh.value = null
  props.renderer?.render(props.scene!, props.camera!)
}

//flip the x and y coordinates of the STL because pytopo3D creates STL using yxz coordinates
function fixOrientation(geometry: THREE.BufferGeometry) {
  if (!geometry.attributes.position) return
  const positions = geometry.attributes.position.array
  if (positions.length % 3 != 0) return
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i] as number
    const y = positions[i + 1] as number
    positions[i] = y
    positions[i + 1] = x
  }
  geometry.attributes.position.needsUpdate = true
  geometry.computeVertexNormals()
}
</script>
