<template>
  <div ref="containerRef" class="viewer"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
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
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let renderer: THREE.WebGLRenderer
let pointCloud: THREE.Points
let geometry: THREE.BufferGeometry

function updatePointCloud(densityData: Uint8Array) {
  if (!geometry) return
  const { nelx, nely, nelz, threshold } = props
  if (!nelx || !nely || !nelz || !threshold) return
  if (densityData.length !== nelx * nely * nelz) {
    console.error('Density array length does not match expected size')
    return
  }
  const positions: number[] = []
  const colors: number[] = []

  let idx = 0
  for (let y = 0; y < nely; y++) {
    for (let x = 0; x < nelx; x++) {
      for (let z = 0; z < nelz; z++) {
        const byteVal = densityData[idx++]
        const density = byteVal! / 255
        if (density < threshold) continue
        positions.push(x, y, z)
        // Map density to color: low -> blue, high -> red
        colors.push(density, 0, 1 - density)
      }
    }
  }

  geometry.dispose()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3))

  const pointSize = Math.min(0.2, 50 / Math.max(nelx, nely, nelz))
  if (pointCloud) (pointCloud.material as THREE.PointsMaterial).size = pointSize
}

watch(latestDensityData, (newData) => {
  if (newData) {
    updatePointCloud(newData)
  }
})

//if dims change while viewer is active, reset camera or do nothing
watch(
  () => [props.nelx, props.nely, props.nelz],
  () => {
    if (camera && props.nelx && props.nely && props.nelz) {
      const maxDim = Math.max(props.nelx, props.nely, props.nelz)
      camera.position.set(maxDim * 1.2, maxDim * 1.2, maxDim * 1.2)
      camera.lookAt(maxDim / 2, maxDim / 2, maxDim / 2)
      camera.updateProjectionMatrix()
    }
  },
)

watch(
  () => [props.threshold],
  () => {
    if (latestDensityData.value) updatePointCloud(latestDensityData.value)
  },
  //{ immediate: true } //not sure if this is important, tbd
)

onMounted(() => {
  if (!containerRef.value) return

  //setup Three.js scene
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x111122)

  //initial camera
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000)
  camera.position.set(50, 50, 50)
  camera.lookAt(0, 0, 0)

  renderer = new THREE.WebGLRenderer()
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  containerRef.value.appendChild(renderer.domElement)

  new OrbitControls(camera, renderer.domElement)

  //create empty geometry
  geometry = new THREE.BufferGeometry()
  const material = new THREE.PointsMaterial({ vertexColors: true, size: 0.1 })
  pointCloud = new THREE.Points(geometry, material)
  scene.add(pointCloud)

  //start animation loop
  function animate() {
    requestAnimationFrame(animate)
    renderer.render(scene, camera)
  }
  animate()

  window.addEventListener('resize', onResize)
})

function onResize() {
  if (!containerRef.value || !camera || !renderer) return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  renderer?.dispose()
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
