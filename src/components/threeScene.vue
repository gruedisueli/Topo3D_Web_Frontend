<template>
  <div
    ref="containerRef"
    class="viewer"
    @mousemove="onMouseMove"
    @mouseleave="onMouseLeave"
    @mousedown="onMouseDown"
    @click="onCanvasClick"
  >
    <ControlPanel
      @start="handleStart"
      @stop="handleStop"
      @update:dimensions="handleDimensionsUpdate"
      @update:threshold="handleThresholdUpdate"
      @load-scene="handleLoadScene"
      @load-stl-scene="handleLoadStlScene"
      @stl-loaded="handleStlLoaded"
      @save-results="handleSaveResults"
      @update:scaling-matrix="handleUpdateScalingMatrix"
      v-model:autorotate="autoRotate"
      v-model:design-space-visible="designSpaceVisible"
      v-model:design-conditions-visible="designConditionsVisible"
      v-model:results-visible="resultsVisible"
    />
    <TransformToolbar
      @mode-change="handleTransformModeChange"
      @force-strength-change="handleForceStrengthChange"
    />
    <OrbitHints></OrbitHints>
    <ObjectHint></ObjectHint>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, ref, provide, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import { STLExporter } from 'three/examples/jsm/Addons.js'
import { useVoxelVisualization } from '@/composables/useVoxelVisualization.ts'
import { useSceneObjects } from '@/composables/useSceneObjects.ts'
import { useVoxelization } from '@/composables/useVoxelization.ts'
import { useOptimization } from '@/composables/useOptimization.ts'
import { useResultsVisualization } from '@/composables/useResultsVisualization'
import { useHover } from '@/composables/useHover.ts'
import type { SavedScene } from '@/types/scene'
import ControlPanel from './controlPanel.vue'
import TransformToolbar from './transformToolbar.vue'
import OrbitHints from './orbitHints.vue'
import { EffectComposer } from 'three/examples/jsm/Addons.js'
import { RenderPass } from 'three/examples/jsm/Addons.js'
import { OutlinePass } from 'three/examples/jsm/Addons.js'
import { OutputPass } from 'three/examples/jsm/Addons.js'
import ObjectHint from './objectHint.vue'

const scene = shallowRef<THREE.Scene | null>(null)
const camera = shallowRef<THREE.PerspectiveCamera | null>(null)
const renderer = shallowRef<THREE.WebGLRenderer | null>(null)
const composer = shallowRef<EffectComposer | null>(null)
const outlinePass = shallowRef<OutlinePass | null>(null)
const orbitControls = shallowRef<OrbitControls | null>(null)
const pointer = ref(new THREE.Vector2(0, 0))
const mouseClientPos = ref(new THREE.Vector2(0, 0))
const optimizer = useOptimization()
const voxelizer = useVoxelization()
const resultsVisualization = ref<ReturnType<typeof useResultsVisualization> | null>(null)
const sceneObjects = shallowRef<ReturnType<typeof useSceneObjects> | null>(null)
const hover = shallowRef<ReturnType<typeof useHover> | null>(null)
const voxelVisualization = ref<ReturnType<typeof useVoxelVisualization> | null>(null)
const nelx = ref(32)
const nely = ref(16)
const nelz = ref(8)
const threshold = ref(0.001)
const userIdle = ref<boolean>(false)
const autoRotateDelayTime = 60000 //milliseconds
const autoRotate = ref(true)
const designSpaceVisible = ref(true)
const designConditionsVisible = ref(true)
const resultsVisible = ref(true)
let autoRotateTimeout = 0
let inverseScalingMatrix = new THREE.Matrix4()

//use provide for global values
provide('scene', scene)
provide('camera', camera)
provide('renderer', renderer)
provide('orbitControls', orbitControls)
provide('pointer', pointer)
provide('mouseClientPos', mouseClientPos)
provide('registerUpdate', registerUpdate)
provide('registerClick', registerClick)
provide('registerMouseLeave', registerMouseLeave)
provide('nelx', nelx)
provide('nely', nely)
provide('nelz', nelz)
provide('optimizer', optimizer)
provide('voxelizer', voxelizer)
provide('voxelVisualization', voxelVisualization)
provide('sceneObjects', sceneObjects)
provide('hover', hover)
provide('userIdle', userIdle)

const containerRef = ref<HTMLDivElement>()

//update function registration
const updateCallbacks: (() => void)[] = []
function registerUpdate(callback: () => void) {
  updateCallbacks.push(callback)
  // Return a function to unregister later (cleanup)
  return () => {
    const index = updateCallbacks.indexOf(callback)
    if (index > -1) updateCallbacks.splice(index, 1)
  }
}

function startAutoRotate() {
  if (!orbitControls.value || !autoRotate.value) return
  userIdle.value = true
  orbitControls.value.autoRotate = true
}

function resetAutoRotateTimer() {
  if (!orbitControls.value) return
  orbitControls.value.autoRotate = false
  userIdle.value = false
  clearTimeout(autoRotateTimeout)
  autoRotateTimeout = setTimeout(startAutoRotate, autoRotateDelayTime)
}

onMounted(() => {
  if (!containerRef.value) return

  //setup Three.js scene
  scene.value = new THREE.Scene()
  scene.value.background = new THREE.Color(0x111122)

  //initial camera
  camera.value = new THREE.PerspectiveCamera(
    45,
    containerRef.value.clientWidth / containerRef.value.clientHeight,
    0.1,
    1000,
  )
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
  orbitControls.value.autoRotateSpeed = 0.5

  //instantiate composables
  sceneObjects.value = useSceneObjects(scene, camera, renderer, orbitControls, nelx, nely, nelz)
  voxelVisualization.value = useVoxelVisualization(
    nelx,
    nely,
    nelz,
    threshold,
    voxelizer.supportMask,
    voxelizer.obstacleMask,
    voxelizer.meshMask,
    voxelizer.forcePoints,
    optimizer.latestDensityData,
    scene,
  )
  resultsVisualization.value = useResultsVisualization(scene, camera, renderer, optimizer)
  hover.value = useHover(scene, sceneObjects.value.objects, camera, renderer, pointer)

  //composer (for outline effects)
  composer.value = new EffectComposer(renderer.value)
  const renderPass = new RenderPass(scene.value, camera.value)
  outlinePass.value = new OutlinePass(
    new THREE.Vector2(containerRef.value.clientWidth, containerRef.value.clientHeight),
    scene.value,
    camera.value,
  )
  outlinePass.value.visibleEdgeColor.set('#ffffff') // Edge color in front
  outlinePass.value.hiddenEdgeColor.set('#ffffff') // Edge color when behind objects
  composer.value.addPass(renderPass)
  composer.value.addPass(outlinePass.value)
  composer.value.addPass(new OutputPass())

  //start animation loop
  function animate() {
    requestAnimationFrame(animate)
    for (const cb of updateCallbacks) {
      cb() // Runs every child's custom logic (rotation, hover, etc.)
    }
    hover.value?.updateHover()
    composer.value?.render()
    orbitControls?.value?.update()
  }
  animate()
  resetAutoRotateTimer()
  startAutoRotate()
  window.addEventListener('resize', onResize)
})

function onResize() {
  if (
    !containerRef.value ||
    !camera.value ||
    !renderer.value ||
    !composer.value ||
    !outlinePass.value ||
    !scene.value
  )
    return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera.value.aspect = width / height
  camera.value.updateProjectionMatrix()
  renderer.value.setSize(width, height)
  composer.value.setSize(width, height)
  composer.value.removePass(outlinePass.value)
  outlinePass.value = new OutlinePass(new THREE.Vector2(width, height), scene.value, camera.value)
  outlinePass.value.visibleEdgeColor.set('#ffffff') // Edge color in front
  outlinePass.value.hiddenEdgeColor.set('#ffffff') // Edge color when behind objects
  composer.value.addPass(outlinePass.value)
}

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  renderer.value?.dispose()
})

function onMouseMove(event: MouseEvent) {
  if (!renderer.value) return
  mouseClientPos.value = new THREE.Vector2(event.clientX, event.clientY)
  const rect = renderer.value.domElement.getBoundingClientRect()
  pointer.value = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  )
  hover.value?.mouseMoveHover()
  resetAutoRotateTimer()
}

// Create a mouse leave callback registry
const leaveCallbacks: (() => void)[] = []
// Provide a registration function
function registerMouseLeave(callback: () => void) {
  leaveCallbacks.push(callback)
  return () => {
    const index = leaveCallbacks.indexOf(callback)
    if (index > -1) leaveCallbacks.splice(index, 1)
  }
}
function onMouseLeave() {
  for (const cb of leaveCallbacks) {
    cb()
  }
  hover.value?.mouseLeaveHover()
}

const downPos = ref({ x: 0, y: 0 })
function onMouseDown(event: MouseEvent) {
  downPos.value = { x: event.clientX, y: event.clientY }
}

const dragThreshold = 4 //pixels
function onCanvasClick(event: MouseEvent) {
  //filter drag events
  const dx = event.clientX - downPos.value.x
  const dy = event.clientY - downPos.value.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist > dragThreshold) return

  // Notify every child that registered for clicks
  //no need to get actual position because stored in pointer
  for (const cb of clickCallbacks) {
    cb(pointer.value, event) // Pass the pointer and raw event
  }
  sceneObjects?.value?.pickObject(pointer.value.x, pointer.value.y)
}

// Create a click callback registry
const clickCallbacks: ((pointer: THREE.Vector2, event: MouseEvent) => void)[] = []

// Provide a registration function
function registerClick(callback: (pointer: THREE.Vector2, event: MouseEvent) => void) {
  clickCallbacks.push(callback)
  return () => {
    const index = clickCallbacks.indexOf(callback)
    if (index > -1) clickCallbacks.splice(index, 1)
  }
}

function handleLoadScene(sceneData: SavedScene) {
  basicSceneLoad(sceneData)
}

async function handleLoadStlScene(sceneData: SavedScene, mesh: THREE.Mesh) {
  basicSceneLoad(sceneData)
  //console.log('loading scene mesh', `nelx: ${nelx.value}, nely: ${nely.value}, nelz: ${nelz.value}`)
  try {
    await voxelizer.voxelizeMesh([nelx.value, nely.value, nelz.value], mesh)
  } catch (err) {
    console.error('failed to voxelize scene mesh: ', err)
  }
}

function basicSceneLoad(sceneData: SavedScene) {
  optimizer.reset()
  if (!sceneObjects?.value) return
  voxelVisualization.value?.clear()
  resultsVisualization.value?.clear()
  voxelizer.clearVoxelMasks()
  sceneObjects.value.loadSceneFromData(sceneData)
}

async function handleStlLoaded(mesh: THREE.Mesh) {
  if (!sceneObjects?.value) return
  voxelVisualization.value?.clear()
  resultsVisualization.value?.clear()
  sceneObjects.value.clearAllObjects()
  //console.log('voxelizing mesh', `nelx: ${nelx.value}, nely: ${nely.value}, nelz: ${nelz.value}`)
  await voxelizer.voxelizeMesh([nelx.value, nely.value, nelz.value], mesh)
  console.log('voxelizing mesh complete')
}

function handleStart(params: Record<string, unknown>) {
  voxelVisualization.value?.clear()
  //merge obstacle mask with inverted STL mask (block out everything outside the STL as not part of the design space)
  const mergedObstacleMask = voxelizer.meshMask.value
    ? new Uint8Array(voxelizer.meshMask.value.length)
    : (voxelizer.obstacleMask.value ?? [])

  if (voxelizer.meshMask.value) {
    if (
      voxelizer.obstacleMask.value &&
      voxelizer.meshMask.value.length != voxelizer.obstacleMask.value.length
    ) {
      console.error('Obstacle mask length does not match mesh mask length')
      return
    }
    const obsMask = voxelizer.obstacleMask.value ?? new Uint8Array(voxelizer.meshMask.value.length)
    for (let idx = 0; idx < obsMask.length; idx++) {
      const invertedMeshVal = voxelizer.meshMask.value[idx] === 0 ? 1 : 0
      mergedObstacleMask[idx] = invertedMeshVal > 0 || obsMask[idx]! > 0 ? 1 : 0
    }
  }

  params['supports'] = voxelizer.supportMask.value
    ? Array.from(voxelizer.supportMask.value as Uint8Array)
    : []
  params['obstacles'] = Array.from(mergedObstacleMask as Uint8Array)
  params['forces'] = voxelizer.forcePoints.value ? voxelizer.forcePoints.value : []
  console.log('sending params: ', params)
  optimizer.connect(params)
}

function handleStop() {
  optimizer.stop()
}

watch(optimizer.status, (currentStatus) => {
  if (currentStatus != 'complete') return
  voxelVisualization.value?.clear()
})

watch(
  () => sceneObjects?.value?.objects,
  () => {
    handleVoxelize()
  },
  { deep: true },
)

watch(
  () => sceneObjects.value?.selectedMesh.value,
  (newMesh) => {
    if (!outlinePass.value) return
    outlinePass.value.selectedObjects = newMesh ? [newMesh] : []
  },
)

watch(designSpaceVisible, (visible) => {
  voxelVisualization.value?.showHideVoxelField(visible)
})

watch(designConditionsVisible, (visible) => {
  sceneObjects.value?.showHideSceneObjects(visible)
  voxelVisualization.value?.showHideVoxels(visible)
})

watch(resultsVisible, (visible) => {
  resultsVisualization.value?.showHideResults(visible)
})

function handleDimensionsUpdate(dims: { nelx: number; nely: number; nelz: number }) {
  nelx.value = dims.nelx
  nely.value = dims.nely
  nelz.value = dims.nelz
  handleVoxelize()
}

function handleThresholdUpdate(thresh: number) {
  threshold.value = thresh
}

async function handleVoxelize() {
  console.log('voxelizing primitives')
  const objects = sceneObjects?.value?.objects.value
  if (!objects) return
  const voxelizeObjs: Array<{
    matrixWorld: number[]
    type: string
    category: string
    forceVector?: [number, number, number]
  }> = []
  for (const o of objects) {
    voxelizeObjs.push({
      matrixWorld: o.transform.toArray(),
      type: o.primitive,
      category: o.category,
      forceVector: o.forceVector ? [o.forceVector.x, o.forceVector.y, o.forceVector.z] : undefined,
    })
  }
  const worldMin: [number, number, number] = [0, 0, 0]
  const worldMax: [number, number, number] = [nelx.value, nely.value, nelz.value]
  const gridSize: [number, number, number] = [nelx.value, nely.value, nelz.value]

  await voxelizer.voxelizePrimitives(gridSize, worldMin, worldMax, voxelizeObjs)
  console.log('voxe.valuelizing primitives complete')
}

function handleTransformModeChange(mode: string) {
  if (!sceneObjects?.value) return
  sceneObjects.value.showTransformControls(mode)
}

function handleForceStrengthChange(strength: number) {
  if (!sceneObjects?.value) return
  sceneObjects.value.updateForceStrength(strength)
}

function handleSaveResults() {
  if (!resultsVisualization?.value?.stlMesh) return

  //un-transform the mesh, which previously was scaled/translated to fit within voxel grid
  const meshCopy = resultsVisualization.value.stlMesh.clone()
  meshCopy.geometry = resultsVisualization.value.stlMesh.geometry.clone() //clone geometry as well so we don't modify the original mesh's geometry
  meshCopy.geometry.applyMatrix4(inverseScalingMatrix)

  //file export
  const exporter = new STLExporter()
  const stlData = exporter.parse(meshCopy, { binary: true })
  const blob = new Blob([stlData], { type: 'application/octet-stream' })
  const link = document.createElement('a')
  link.style.display = 'none'
  document.body.appendChild(link)
  link.href = URL.createObjectURL(blob)
  link.download = 'results.stl'
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

function handleUpdateScalingMatrix(matrix: THREE.Matrix4) {
  inverseScalingMatrix = matrix.clone().invert()
}
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
