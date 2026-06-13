<template>
  <div>
    <ControlPanel
      @voxelize="handleVoxelize"
      @start="handleStart"
      @stop="handleStop"
      @update:dimensions="handleDimensionsUpdate"
      @update:threshold="handleThresholdUpdate"
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
      :force-mask="forceMask"
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

const voxelViewerRef = ref<InstanceType<typeof VoxelViewer> | null>(null)
const stlViewerRef = ref<InstanceType<typeof StlViewer> | null>(null)
const transformToolbarRef = ref<InstanceType<typeof TransformToolbar> | null>(null)
let sceneObjects: ReturnType<typeof useSceneObjects> | null = null

const { status, connect, stop } = useOptimization()
const { supportMask, obstacleMask, forcePoints, voxelize } = useVoxelization()
const forceMask = null

//Reactive dimensions (initial defaults)
const nelx = ref(32)
const nely = ref(16)
const nelz = ref(8)

//threshold (initial default)
const threshold = ref(0.01)

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
    )
    sceneObjectsReady.value = true
  }
})

function handleCanvasClick(mouseX: number, mouseY: number) {
  if (!sceneObjects) return
  sceneObjects.pickObject(mouseX, mouseY)
  transformToolbarRef.value?.selectObject()
}

function handleStart(params: Record<string, unknown>) {
  voxelViewerRef.value?.clear()
  //stlViewerRef.value?.clear()
  params['supports'] = supportMask.value ? Array.from(supportMask.value as Uint8Array) : []
  params['obstacles'] = obstacleMask.value ? Array.from(obstacleMask.value as Uint8Array) : []
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

function handleDimensionsUpdate(dims: { nelx: number; nely: number; nelz: number }) {
  nelx.value = dims.nelx
  nely.value = dims.nely
  nelz.value = dims.nelz
}

function handleThresholdUpdate(thresh: number) {
  threshold.value = thresh
}

async function handleVoxelize() {
  console.log('voxelizing')

  const objects = sceneObjects?.objects.value
  if (!objects) return
  const voxelizeObjs: Array<{
    matrixWorld: number[]
    type: string
    category: string
    forceVector?: [number, number, number]
  }> = []
  for (const o of objects) {
    console.log(o.transform)
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

  await voxelize(gridSize, worldMin, worldMax, voxelizeObjs)
  console.log('voxelizing complete')
}

function handleTransformModeChange(mode: string) {
  if (!sceneObjects) return
  sceneObjects.showTransformControls(mode)
}

function handleForceStrengthChange(strength: number) {
  if (!sceneObjects) return
  sceneObjects.updateForceStrength(strength)
}
</script>
