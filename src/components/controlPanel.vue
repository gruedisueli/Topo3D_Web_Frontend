<template>
  <div class="controls">
    <h3>Topology Optimization</h3>
    <div class="form-group">
      <label>Grid X</label>
      <input type="number" v-model.number="localNelx" min="10" max="200" />
    </div>
    <div class="form-group">
      <label>Grid Y</label>
      <input type="number" v-model.number="localNely" min="10" max="200" />
    </div>
    <div class="form-group">
      <label>Grid Z</label>
      <input type="number" v-model.number="localNelz" min="10" max="200" />
    </div>
    <div class="form-group">
      <label>Volume Fraction</label>
      <input type="range" v-model.number="params.volfrac" min="0.1" max="0.9" step="0.1" />
      <span>{{ params.volfrac }}</span>
    </div>
    <div class="form-group">
      <label>Penalization</label>
      <input type="range" v-model.number="params.penal" min="1.0" max="4.0" step="0.1" />
      <span>{{ params.penal }}</span>
    </div>
    <div class="form-group">
      <label>Filter radius</label>
      <input type="number" v-model.number="params.rmin" step="0.5" />
    </div>
    <div class="status-panel">
      <p>Status: {{ status }}</p>
      <p v-if="queuePosition !== null">Queue {{ queuePosition }}</p>
      <p v-if="error">Error: {{ error }}</p>
    </div>
    <button @click="start" :disabled="isStarting || status === 'running'">Start</button>
    <button @click="stop" :disabled="!isStarting && status !== 'running'">Stop</button>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, ref } from 'vue'
import { useOptimization } from '@/composables/useOptimization'

const emit = defineEmits<{
  (e: 'start', params: Record<string, unknown>): void
  (e: 'stop'): void
  (e: 'update:dimensions', dims: { nelx: number; nely: number; nelz: number }): void
}>()

const { status, queuePosition, error, isStarting } = useOptimization()

//local UI state
const localNelx = ref(32)
const localNely = ref(16)
const localNelz = ref(8)

const params = reactive({
  volfrac: 0.3,
  penal: 3.0,
  rmin: 1.5,
  disp_thres: 0.5,
  maxloop: 200,
  gpu: true,
})

//emit dimensions whenever they change locally
watch([localNelx, localNely, localNelz], () => {
  emit('update:dimensions', {
    nelx: localNelx.value,
    nely: localNely.value,
    nelz: localNelz.value,
  })
})

function start() {
  emit('start', {
    nelx: localNelx.value,
    nely: localNely.value,
    nelz: localNelz.value,
    volfrac: params.volfrac,
    penal: params.penal,
    rmin: params.rmin,
    disp_thres: params.disp_thres,
    maxloop: params.maxloop,
    gpu: params.gpu,
  })
}

function stop() {
  emit('stop')
}
</script>

<style scoped>
.controls {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(255, 0, 0, 0.8); /* bright red for debugging */
  color: white;
  padding: 15px;
  border-radius: 8px;
  width: 280px;
  z-index: 10;
}
</style>
