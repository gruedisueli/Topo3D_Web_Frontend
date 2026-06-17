<template>
  <div>
    <ControlPanel
      ref="controlPanelRef"
      @start="handleStart"
      @stop="handleStop"
      @update:dimensions="handleDimensionsUpdate"
      @update:threshold="handleThresholdUpdate"
      @load-scene="handleLoadScene"
      @load-stl-scene="handleLoadStlScene"
      @stl-loaded="handleStlLoaded"
      @save-results="handleSaveResults"
      :scene="sceneForViewers"
      :camera="voxelViewerRef?.camera"
      :renderer="voxelViewerRef?.renderer"
    />
    <VoxelViewer
      @canvas-click="handleCanvasClick"
      ref="voxelViewerRef"
      :nelx="nelx"
      :nely="nely"
      :nelz="nelz"
      :threshold="threshold"
      :support-mask="supportMask"
      :obstacle-mask="obstacleMask"
      :forcePoints="forcePoints"
      :mesh-mask="meshMask"
    />
    <TransformToolbar
      v-if="isTransformToolbarVisible"
      ref="transformToolbarRef"
      :scene-objects="sceneObjects"
      :selected-mesh="selectedMeshForToolbar"
      :camera="voxelViewerRef?.camera"
      :renderer="voxelViewerRef?.renderer"
      @mode-change="handleTransformModeChange"
      @force-strength-change="handleForceStrengthChange"
    />
    <StlViewer
      ref="stlViewerRef"
      :scene="sceneForViewers"
      :camera="voxelViewerRef?.camera"
      :renderer="voxelViewerRef?.renderer"
    />
    <EditorToolbar v-if="sceneObjectsReady" :scene-objects="sceneObjects" />
    <!-- <PropertiesPanel v-if="sceneObjectsReady" :scene-objects="sceneObjects" /> -->
  </div>
</template>

<script setup lang="ts">
import VoxelViewer from './components/voxelViewer.vue'
import ControlPanel from './components/controlPanel.vue'
import { ref, onMounted, computed, watch } from 'vue'
import { useOptimization } from './composables/useOptimization.ts'
import EditorToolbar from './components/editorToolbar.vue'
//import PropertiesPanel from './components/propertiesPanel.vue'
import { useSceneObjects } from './composables/useSceneObjects.ts'
import { useVoxelization } from './composables/useVoxelization.ts'
import TransformToolbar from './components/transformToolbar.vue'
import StlViewer from './components/stlViewer.vue'
import type { SavedScene } from './types/scene.ts'
import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/Addons.js'

const voxelViewerRef = ref<InstanceType<typeof VoxelViewer> | null>(null)
const stlViewerRef = ref<InstanceType<typeof StlViewer> | null>(null)
const controlPanelRef = ref<InstanceType<typeof ControlPanel> | null>(null)
const transformToolbarRef = ref<InstanceType<typeof TransformToolbar> | null>(null)
let sceneObjects: ReturnType<typeof useSceneObjects> | null = null
const currentObjects = computed(() => {
  return sceneObjectsReady.value && sceneObjects ? sceneObjects.objects.value : []
})

const { status, connect, stop } = useOptimization()
const {
  supportMask,
  obstacleMask,
  forcePoints,
  meshMask,
  voxelizePrimitives,
  voxelizeMesh,
  clearVoxelMasks,
} = useVoxelization()

//Reactive dimensions (initial defaults)
const nelx = ref(32)
const nely = ref(16)
const nelz = ref(8)

//threshold (initial default)
const threshold = ref(0.001)

const sceneObjectsReady = ref(false)

const isTransformToolbarVisible = computed(() => {
  return (
    sceneObjectsReady.value &&
    sceneObjects?.selectedId &&
    voxelViewerRef.value?.camera &&
    voxelViewerRef.value?.renderer
  )
})

const selectedMeshForToolbar = computed(() => {
  if (!sceneObjectsReady.value || !sceneObjects) return undefined
  return sceneObjects.selectedMesh.value
})

const sceneForViewers = computed(() => {
  if (!voxelViewerRef.value) return null
  return voxelViewerRef.value.scene
})

onMounted(() => {
  //wait for VoxelViewer to initialize the scene
  const viewer = voxelViewerRef.value
  if (viewer && viewer.scene && viewer.camera && viewer.renderer && viewer.orbitControls) {
    sceneObjects = useSceneObjects(
      viewer.scene,
      viewer.camera,
      viewer.renderer,
      viewer.orbitControls,
      nelx,
      nely,
      nelz,
    )
    sceneObjectsReady.value = true
  }
})

function handleLoadScene(sceneData: SavedScene) {
  basicSceneLoad(sceneData)
}

async function handleLoadStlScene(sceneData: SavedScene, mesh: THREE.Mesh) {
  basicSceneLoad(sceneData)
  //console.log('loading scene mesh', `nelx: ${nelx.value}, nely: ${nely.value}, nelz: ${nelz.value}`)
  try {
    await voxelizeMesh([nelx.value, nely.value, nelz.value], mesh)
  } catch (err) {
    console.error('failed to voxelize scene mesh: ', err)
  }
}

function basicSceneLoad(sceneData: SavedScene) {
  if (!sceneObjects) return
  voxelViewerRef.value?.clear()
  stlViewerRef.value?.clear()
  clearVoxelMasks()
  sceneObjects.loadSceneFromData(sceneData)
}

async function handleStlLoaded(mesh: THREE.Mesh) {
  if (!sceneObjects) return
  voxelViewerRef.value?.clear()
  stlViewerRef.value?.clear()
  sceneObjects.clearAllObjects()
  //console.log('voxelizing mesh', `nelx: ${nelx.value}, nely: ${nely.value}, nelz: ${nelz.value}`)
  await voxelizeMesh([nelx.value, nely.value, nelz.value], mesh)
  console.log('voxelizing mesh complete')
}

function handleCanvasClick(mouseX: number, mouseY: number) {
  if (!sceneObjects) return
  sceneObjects.pickObject(mouseX, mouseY)
  transformToolbarRef.value?.selectObject()
}

function handleStart(params: Record<string, unknown>) {
  voxelViewerRef.value?.clear()
  //stlViewerRef.value?.clear()

  //merge obstacle mask with inverted STL mask (block out everything outside the STL as not part of the design space)
  const mergedObstacleMask = meshMask.value
    ? new Uint8Array(meshMask.value.length)
    : (obstacleMask.value ?? [])

  if (meshMask.value) {
    if (obstacleMask.value && meshMask.value.length != obstacleMask.value.length) {
      console.error('Obstacle mask length does not match mesh mask length')
      return
    }
    const obsMask = obstacleMask.value ?? new Uint8Array(meshMask.value.length)
    for (let idx = 0; idx < obsMask.length; idx++) {
      const invertedMeshVal = meshMask.value[idx] === 0 ? 1 : 0
      mergedObstacleMask[idx] = invertedMeshVal > 0 || obsMask[idx]! > 0 ? 1 : 0
    }
  }

  params['supports'] = supportMask.value ? Array.from(supportMask.value as Uint8Array) : []
  params['obstacles'] = Array.from(mergedObstacleMask as Uint8Array)
  params['forces'] = forcePoints.value ? forcePoints.value : []
  console.log('sending params: ', params)
  connect(params)
}

function handleStop() {
  stop()
}

watch(status, (currentStatus) => {
  if (currentStatus != 'complete') return
  voxelViewerRef.value?.clear()
})

watch(
  currentObjects,
  () => {
    if (sceneObjectsReady.value && sceneObjects) {
      handleVoxelize()
    }
  },
  { deep: true },
)

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
  const objects = sceneObjects?.objects.value
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

  await voxelizePrimitives(gridSize, worldMin, worldMax, voxelizeObjs)
  console.log('voxelizing primitives complete')
}

function handleTransformModeChange(mode: string) {
  if (!sceneObjects) return
  sceneObjects.showTransformControls(mode)
}

function handleForceStrengthChange(strength: number) {
  if (!sceneObjects) return
  sceneObjects.updateForceStrength(strength)
}

function handleSaveResults() {
  if (!stlViewerRef.value?.stlMesh || !controlPanelRef.value) return

  //un-transform the mesh, which previously was scaled/translated to fit within voxel grid
  const meshCopy = stlViewerRef.value.stlMesh.clone()
  meshCopy.geometry = stlViewerRef.value.stlMesh.geometry.clone() //clone geometry as well so we don't modify the original mesh's geometry
  const invMatrix = controlPanelRef.value.stlScalingMatrix.clone().invert()
  meshCopy.geometry.applyMatrix4(invMatrix)

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
</script>
