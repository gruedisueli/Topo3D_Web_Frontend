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
      <input type="range" v-model.number="user_params.volfrac" min="0.1" max="0.9" step="0.1" />
      <span>{{ user_params.volfrac }}</span>
    </div>
    <div class="form-group">
      <label>Penalization</label>
      <input type="range" v-model.number="user_params.penal" min="1.0" max="4.0" step="0.1" />
      <span>{{ user_params.penal }}</span>
    </div>
    <div class="form-group">
      <label>Filter radius</label>
      <input type="number" v-model.number="user_params.rmin" step="0.5" />
    </div>
    <div class="status-panel">
      <p>Status: {{ status }}</p>
      <p v-if="queuePosition !== null">Queue {{ queuePosition }}</p>
      <p v-if="error">Error: {{ error }}</p>
    </div>
    <div class="form-group">
      <label>Design Space STL (optional)</label>
      <input
        type="file"
        ref="stlInput"
        accept=".stl"
        @change="handleFileSelect"
        style="display: none"
      />
      <button @click="triggerFilePicker">Select STL File</button>
      <span v-if="uploadedStlName">{{ uploadedStlName }} (uploaded)</span>
    </div>
    <button @click="voxelize">Voxelize</button>
    <button @click="start" :disabled="isStarting || status === 'running'">Start</button>
    <button @click="stop" :disabled="!isStarting && status !== 'running'">Stop</button>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, ref } from 'vue'
import { useOptimization } from '@/composables/useOptimization'

const emit = defineEmits<{
  (e: 'voxelize'): void
  (e: 'start', params: Record<string, unknown>): void
  (e: 'stop'): void
  (e: 'update:dimensions', dims: { nelx: number; nely: number; nelz: number }): void
}>()

const { status, queuePosition, error, isStarting } = useOptimization()

//local UI state
const localNelx = ref(32)
const localNely = ref(16)
const localNelz = ref(8)

const user_params = reactive({
  volfrac: 0.3,
  penal: 3.0,
  rmin: 1.5,
  disp_thres: 0.5,
  tolx: 0.01,
  maxloop: 200,
  pitch: 1.0,
  invert_design_space: false,
})

const stlInput = ref<HTMLInputElement | null>(null)
const uploadedStlId = ref<string | null>(null)
const uploadedStlName = ref<string | null>(null)
const isUploading = ref(false)

//emit dimensions whenever they change locally
watch([localNelx, localNely, localNelz], () => {
  emit('update:dimensions', {
    nelx: localNelx.value,
    nely: localNely.value,
    nelz: localNelz.value,
  })
})

//trigger file picker (hidden)
function triggerFilePicker() {
  stlInput.value?.click()
}

//handle file selection
async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length !== 1) return
  const file = input.files[0]
  if (!file?.name.endsWith('.stl')) {
    alert('Please select a .stl file')
    return
  }

  isUploading.value = true
  uploadedStlId.value = null
  uploadedStlName.value = null
  try {
    const stlId = await uploadSTL(file)
    uploadedStlId.value = stlId
    uploadedStlName.value = file.name
    console.log('STL uploaded, ID:', stlId)
  } catch (err) {
    console.error('Upload failed', err)
    alert('Failed to upload STL file')
  } finally {
    isUploading.value = false
    input.value = ''
  }
}

async function uploadSTL(file: File): Promise<string> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('http://localhost:8000/upload-stl', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error('Upload failed')
  }

  const { stl_id } = await response.json()
  return stl_id
}

function voxelize() {
  emit('voxelize')
}

function start() {
  emit('start', {
    nelx: localNelx.value,
    nely: localNely.value,
    nelz: localNelz.value,
    volfrac: user_params.volfrac,
    penal: user_params.penal,
    rmin: user_params.rmin,
    tolx: user_params.tolx,
    maxloop: user_params.maxloop,
    pitch: user_params.pitch,
    invert_design_space: user_params.invert_design_space,
    design_space_stl_id: uploadedStlId.value,
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
