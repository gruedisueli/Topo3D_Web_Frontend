<template>
  <div ref="containerRef" class="viewer" @mousedown="onMouseDown" @click="onCanvasClick"></div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onMounted, watch, onUnmounted } from 'vue'
import type { ShallowRef } from 'vue'
import { useOptimization } from '@/composables/useOptimization'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { ForcePoint } from '@/workers/voxelWorker'

const props = defineProps<{
  nelx: number
  nely: number
  nelz: number
  threshold: number
  supportMask: Uint8Array | null
  obstacleMask: Uint8Array | null
  meshMask: Uint8Array | null
  forcePoints: ForcePoint[] | null
}>()

const emit = defineEmits(['canvasClick'])
const dragThreshold = 4 //pixels

function onCanvasClick(event: MouseEvent) {
  //filter drag events
  const dx = event.clientX - downPos.value.x
  const dy = event.clientY - downPos.value.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > dragThreshold) return

  const rect = containerRef.value?.getBoundingClientRect()
  if (!rect) return
  const mouseX = event.clientX - rect.left
  const mouseY = event.clientY - rect.top
  emit('canvasClick', mouseX, mouseY)
}

const downPos = ref({ x: 0, y: 0 })
function onMouseDown(event: MouseEvent) {
  downPos.value = { x: event.clientX, y: event.clientY }
}

const containerRef = ref<HTMLDivElement>()
const { latestDensityData } = useOptimization()

//Three.js globals
const scene = shallowRef<THREE.Scene | null>(null)
const camera = shallowRef<THREE.PerspectiveCamera | null>(null)
const renderer = shallowRef<THREE.WebGLRenderer | null>(null)
const orbitControls = shallowRef<OrbitControls | null>(null)
defineExpose({ scene, camera, renderer, orbitControls, clear })

const iterationsMesh = shallowRef<THREE.InstancedMesh | null>(null)
const voxelFieldMesh = shallowRef<THREE.InstancedMesh | null>(null)
const supportsMesh = shallowRef<THREE.InstancedMesh | null>(null)
const obstaclesMesh = shallowRef<THREE.InstancedMesh | null>(null)
const meshMesh = shallowRef<THREE.InstancedMesh | null>(null)
const forceArrows: THREE.ArrowHelper[] = []

//pre-build a unit cube geometry
const boxGeometry = new THREE.BoxGeometry(0.99, 0.99, 0.99)
const iterationBoxGeometry = new THREE.BoxGeometry(0.75, 0.75, 0.75)
const miniBoxGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1)
const material = new THREE.MeshStandardMaterial({ color: 0x3f7dbd })

function updateVoxels(densityData: Uint8Array) {
  const { nelx, nely, nelz, threshold } = props
  if (!nelx || !nely || !nelz || !threshold) return
  if (densityData.length !== nelx * nely * nelz) {
    console.error('Density array length does not match expected size')
    return
  }
  const positions: THREE.Vector3[] = []
  //const materials: THREE.MeshStandardMaterial[] = []

  let idx = 0
  //returning values from pytopo3d are in y,x,z order
  for (let y = 0; y < nely; y++) {
    for (let x = 0; x < nelx; x++) {
      for (let z = 0; z < nelz; z++) {
        const byteVal = densityData[idx++]
        const density = byteVal! / 255
        if (density < threshold) continue
        positions.push(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5))
        //const color = new THREE.Color(density, 0, 1 - density)
        //materials.push(new THREE.MeshStandardMaterial({ color: color }))
      }
    }
  }

  instantiateVoxels(iterationsMesh, iterationBoxGeometry, material.clone(), positions)
}

//clear all preview voxels from scene
function clear() {
  removeMesh(iterationsMesh)
  removeMesh(supportsMesh)
  removeMesh(obstaclesMesh)
  removeMesh(meshMesh)
  clearArrows()
}

function removeMesh(mesh: ShallowRef<THREE.InstancedMesh | null>) {
  if (!mesh.value) return
  mesh.value.dispose()
  if (Array.isArray(mesh.value.material)) {
    mesh.value.material.forEach((m) => m.dispose())
  } else {
    mesh.value.material?.dispose()
  }
  scene.value?.remove(mesh.value)
  mesh.value = null
}

function instantiateVoxels(
  mesh: ShallowRef<THREE.InstancedMesh | null>,
  prefab: THREE.BoxGeometry,
  materials: THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[],
  positions: THREE.Vector3[],
) {
  if (mesh.value) {
    mesh.value.dispose()
    scene.value?.remove(mesh.value)
    mesh.value = null
  }
  mesh.value = new THREE.InstancedMesh(prefab, materials, positions.length)
  positions.forEach((pos, i) => {
    const m = new THREE.Matrix4()
    m.setPosition(pos.x, pos.y, pos.z)
    mesh.value?.setMatrixAt(i, m)
  })

  mesh.value.instanceMatrix.needsUpdate = true
  scene.value?.add(mesh.value)
}

function updateObjectVoxels(voxelMask: Uint8Array, type: string) {
  const { nelx, nely, nelz } = props
  const positions: THREE.Vector3[] = []

  let idx = 0
  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      for (let z = 0; z < nelz; z++) {
        const byteVal = voxelMask[idx++]
        if (byteVal === 0) continue
        positions.push(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5))
      }
    }
  }

  switch (type) {
    case 'support':
      instantiateVoxels(supportsMesh, boxGeometry, material.clone(), positions)
      break
    case 'obstacle':
      instantiateVoxels(obstaclesMesh, boxGeometry, material.clone(), positions)
      break
    case 'mesh':
      instantiateVoxels(meshMesh, boxGeometry, material.clone(), positions)
      break
    default:
      console.error('unrecognized object type to visualize with voxels')
      return
  }
}

function updateForceArrows() {
  clearArrows()
  if (!props.forcePoints) return
  for (const force of props.forcePoints) {
    const fV = new THREE.Vector3(force.vector[0], force.vector[1], force.vector[2])
    const length = fV.length()
    fV.normalize()
    const pos = indexToXyz(force.index)
    pos.add(new THREE.Vector3(0.5, 0.5, 0.5))
    const arrow = new THREE.ArrowHelper(fV, pos, length, 0xff0000)
    scene.value?.add(arrow)
    forceArrows.push(arrow)
  }
}

function clearArrows() {
  for (const arrow of forceArrows) {
    scene.value?.remove(arrow)
  }
}

function indexToXyz(index: number): THREE.Vector3 {
  const { nely, nelz } = props
  const z = index % nelz
  const y = Math.floor(index / nelz) % nely
  const x = Math.floor(index / (nely * nelz))
  return new THREE.Vector3(x, y, z)
}

function updateVoxelField() {
  const { nelx, nely, nelz } = props
  const positions: THREE.Vector3[] = []

  for (let x = 0; x < nelx; x++) {
    for (let y = 0; y < nely; y++) {
      for (let z = 0; z < nelz; z++) {
        positions.push(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5))
      }
    }
  }

  instantiateVoxels(voxelFieldMesh, miniBoxGeometry, material.clone(), positions)
}

watch(latestDensityData, (newData) => {
  if (newData) {
    updateVoxels(newData)
  }
})

watch(
  () => props.supportMask,
  (newData) => {
    if (newData) updateObjectVoxels(newData, 'support')
  },
)

watch(
  () => props.obstacleMask,
  (newData) => {
    if (newData) updateObjectVoxels(newData, 'obstacle')
  },
)

watch(
  () => props.meshMask,
  (newData) => {
    if (newData) updateObjectVoxels(newData, 'mesh')
  },
)

watch(
  () => props.forcePoints,
  () => {
    updateForceArrows()
  },
)

watch(
  () => [props.nelx, props.nely, props.nelz],
  () => {
    updateVoxelField()
  },
)

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
  // add axes helper
  const axesHelper = new THREE.AxesHelper(5)
  scene.value.add(axesHelper)

  renderer.value = new THREE.WebGLRenderer()
  renderer.value.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight)
  containerRef.value.appendChild(renderer.value.domElement)

  orbitControls.value = new OrbitControls(camera.value, renderer.value.domElement)

  updateVoxelField()

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
