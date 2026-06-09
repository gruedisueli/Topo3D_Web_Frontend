<template>
  <div ref="containerRef" class="viewer"></div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, watch, onUnmounted } from 'vue'
import { useOptimization } from '@/composables/useOptimization'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'

const props = defineProps<{
  nelx: number
  nely: number
  nelz: number
  threshold: number
}>()

const containerRef = ref<HTMLDivElement>()
const { latestDensityData } = useOptimization()

//Three.js globals
const scene = shallowRef<THREE.Scene | null>(null)
const camera = shallowRef<THREE.PerspectiveCamera | null>(null)
const renderer = shallowRef<THREE.WebGLRenderer | null>(null)
const orbitControls = shallowRef<OrbitControls | null>(null)
defineExpose({ scene, camera, renderer, orbitControls })
let instancedMesh: THREE.InstancedMesh | null = null

//pre-build a unit cube geometry
const boxGeometry = new THREE.BoxGeometry(0.99, 0.99, 0.99)
const material = new THREE.MeshStandardMaterial({ color: 0x3f7dbd })

function updateVoxels(densityData: Uint8Array) {
  const { nelx, nely, nelz, threshold } = props
  if (!nelx || !nely || !nelz || !threshold) return
  if (densityData.length !== nelx * nely * nelz) {
    console.error('Density array length does not match expected size')
    return
  }
  const positions: THREE.Vector3[] = []

  let idx = 0
  for (let y = 0; y < nely; y++) {
    for (let x = 0; x < nelx; x++) {
      for (let z = 0; z < nelz; z++) {
        const byteVal = densityData[idx++]
        const density = byteVal! / 255
        if (density < threshold) continue
        positions.push(new THREE.Vector3(x, y, z))
      }
    }
  }

  //remove old mesh if it exists
  if (instancedMesh) {
    instancedMesh.dispose()
    scene.value?.remove(instancedMesh)
    instancedMesh = null
  }

  if (positions.length == 0) return

  //create new instancedMesh
  instancedMesh = new THREE.InstancedMesh(boxGeometry, material, positions.length)
  positions.forEach((pos, i) => {
    const m = new THREE.Matrix4()
    m.setPosition(pos.x, pos.y, pos.z)
    instancedMesh?.setMatrixAt(i, m)
  })

  instancedMesh.instanceMatrix.needsUpdate = true
  scene.value?.add(instancedMesh)
}

watch(latestDensityData, (newData) => {
  if (newData) {
    updateVoxels(newData)
  }
})

// //if dims change while viewer is active, reset camera or do nothing
// watch(
//   () => [props.nelx, props.nely, props.nelz],
//   () => {
//     if (camera && props.nelx && props.nely && props.nelz) {
//       const maxDim = Math.max(props.nelx, props.nely, props.nelz)
//       camera.position.set(maxDim * 1.2, maxDim * 1.2, maxDim * 1.2)
//       camera.lookAt(maxDim / 2, maxDim / 2, maxDim / 2)
//       camera.updateProjectionMatrix()
//     }
//   },
// )

watch(
  () => [props.threshold],
  () => {
    if (latestDensityData.value) updateVoxels(latestDensityData.value)
  },
  //{ immediate: true } //not sure if this is important, tbd
)

onMounted(() => {
  if (!containerRef.value) return

  //setup Three.js scene
  scene.value = new THREE.Scene()
  scene.value.background = new THREE.Color(0x111122)

  //initial camera
  camera.value = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
  camera.value.position.set(50, 50, 50)
  camera.value.lookAt(0, 0, 0)

  // 1. Create a global ambient light so objects aren't pitch black
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5) // (color, intensity)
  scene.value.add(ambientLight)
  // 2. Create a directional light for highlights and shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
  directionalLight.position.set(5, 10, 7) // Position the light in 3D space
  scene.value.add(directionalLight)

  renderer.value = new THREE.WebGLRenderer()
  renderer.value.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  containerRef.value.appendChild(renderer.value.domElement)

  orbitControls.value = new OrbitControls(camera.value, renderer.value.domElement)

  // //create empty geometry
  // geometry = new THREE.BufferGeometry()
  // const material = new THREE.PointsMaterial({ vertexColors: true, size: 0.1 })
  // pointCloud = new THREE.Points(geometry, material)
  // scene.add(pointCloud)

  //start animation loop
  function animate() {
    requestAnimationFrame(animate)
    renderer.value?.render(scene.value!, camera.value!)
  }
  animate()

  window.addEventListener('resize', onResize)
})

function onResize() {
  if (!containerRef.value || !camera.value || !renderer.value) return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera.value.aspect = width / height
  camera.value.updateProjectionMatrix()
  renderer.value.setSize(width, height)
}

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  renderer.value?.dispose()
})
</script>

<style scoped>
.viewer {
  width: 100vw;
  height: 100vh;
  position: absolute;
  top: 0;
  left: 0;
}
</style>
