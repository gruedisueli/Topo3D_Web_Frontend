<template>
  <div>
    <ControlPanel
      @start="handleStart"
      @stop="handleStop"
      @update:dimensions="handleDimensionsUpdate"
      @update:threshold="handleThresholdUpdate"
    />
    <VoxelViewer
      ref="voxelViewerRef"
      :nelx="nelx"
      :nely="nely"
      :nelz="nelz"
      :threshold="threshold"
    />
    <EditorToolbar v-if="sceneObjectsReady" :scene-objects="sceneObjects" />
    <PropertiesPanel v-if="sceneObjectsReady" :scene-objects="sceneObjects" />
  </div>
</template>

<script setup lang="ts">
import VoxelViewer from './components/voxelViewer.vue'
import ControlPanel from './components/controlPanel.vue'
import { ref, onMounted } from 'vue'
import { useOptimization } from './composables/useOptimization.ts'
import EditorToolbar from './components/editorToolbar.vue'
import PropertiesPanel from './components/propertiesPanel.vue'
import { useSceneObjects } from './composables/useSceneObjects.ts'

const voxelViewerRef = ref<InstanceType<typeof VoxelViewer> | null>(null)
let sceneObjects: ReturnType<typeof useSceneObjects> | null = null

const { connect, stop } = useOptimization()

//Reactive dimensions (initial defaults)
const nelx = ref(32)
const nely = ref(16)
const nelz = ref(8)

//threshold (initial default)
const threshold = ref(0.01)

const sceneObjectsReady = ref(false)

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

function handleStart(params: Record<string, unknown>) {
  connect(params)
}

function handleStop() {
  stop()
}

function handleDimensionsUpdate(dims: { nelx: number; nely: number; nelz: number }) {
  nelx.value = dims.nelx
  nely.value = dims.nely
  nelz.value = dims.nelz
}

function handleThresholdUpdate(thresh: number) {
  threshold.value = thresh
}
</script>
