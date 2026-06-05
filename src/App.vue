<template>
  <div>
    <ControlPanel
      @start="handleStart"
      @stop="handleStop"
      @update:dimensions="handleDimensionsUpdate"
      @update:threshold="handleThresholdUpdate"
    />
    <PointCloudViewer :nelx="nelx" :nely="nely" :nelz="nelz" :threshold="threshold" />
  </div>
</template>

<script setup lang="ts">
import PointCloudViewer from './components/pointCloudViewer.vue'
import ControlPanel from './components/controlPanel.vue'
import { ref } from 'vue'
import { useOptimization } from './composables/useOptimization.ts'

const { connect, stop } = useOptimization()

//Reactive dimensions (initial defaults)
const nelx = ref(32)
const nely = ref(16)
const nelz = ref(8)

//threshold (initial default)
const threshold = ref(0.01)

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
