<template>
  <div class="controls">
    <h3>Topology Optimization</h3>
    <div class="form-group">
      <label>Grid X</label>
      <input type="number" v-model.number="localNelx" min="5" :max="maxNelx" />
      <label> Max: {{ maxNelx }}</label>
    </div>
    <div class="form-group">
      <label>Grid Y</label>
      <input type="number" v-model.number="localNely" min="5" :max="maxNely" />
      <label> Max: {{ maxNely }}</label>
    </div>
    <div class="form-group">
      <label>Grid Z</label>
      <input type="number" v-model.number="localNelz" min="5" :max="maxNelz" />
      <label> Max: {{ maxNelz }}</label>
    </div>
    <div class="form-group">
      <label>Current Voxel Count: {{ voxelCt }}</label>
    </div>
    <div class="form-group">
      <label>Max Voxel Ct {{ maxVolume }}</label>
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
      <p v-if="iterationCt !== 0">Iteration {{ iterationCt }} of {{ user_params.maxloop }}</p>
    </div>
    <div class="loading-container" v-if="status === 'running' || status === 'stopping'">
      <div class="spinner"></div>
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
    <button @click="start" :disabled="isStarting || status === 'running'">Start</button>
    <button @click="stop" :disabled="!isStarting && status !== 'running'">Stop</button>
    <div class="form-group">
      <button @click="saveResults" :disabled="status !== 'complete'">Save Results STL</button>
    </div>
    <div class="scene-selector">
      <label>Load Scene: </label>
      <select v-model="selectedScene" @change="selectScene">
        <option v-for="scene in scenes" :key="scene.name" :value="scene.name">
          {{ scene.name }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, ref, onMounted, computed } from 'vue'
import { useOptimization } from '@/composables/useOptimization'
import type { SavedScene } from '@/types/scene'
import { STLLoader } from 'three/examples/jsm/Addons.js'
import * as THREE from 'three'
import type { PropType } from 'vue'

const emit = defineEmits<{
  (e: 'start', params: Record<string, unknown>): void
  (e: 'stop'): void
  (e: 'update:dimensions', dims: { nelx: number; nely: number; nelz: number }): void
  (e: 'loadScene', scene: SavedScene): void
  (e: 'loadStlScene', scene: SavedScene, mesh: THREE.Mesh): void
  (e: 'stlLoaded', stl: THREE.Mesh): void
  (e: 'saveResults'): void
}>()

const props = defineProps({
  scene: Object as PropType<THREE.Scene | null>,
  camera: Object as PropType<THREE.PerspectiveCamera | null>,
  renderer: Object as PropType<THREE.WebGLRenderer | null>,
})

const { status, queuePosition, error, isStarting, iterationCt } = useOptimization()

//local UI state
const maxVolume = 64 * 64 * 64
const localNelx = ref(32)
const localNely = ref(16)
const localNelz = ref(8)
const maxNelx = computed(() => {
  const yz = localNely.value * localNelz.value
  return Math.floor(maxVolume / yz)
})
const maxNely = computed(() => {
  const xz = localNelx.value * localNelz.value
  return Math.floor(maxVolume / xz)
})
const maxNelz = computed(() => {
  const xy = localNelx.value * localNely.value
  return Math.floor(maxVolume / xy)
})
const voxelCt = computed(() => {
  return localNelx.value * localNely.value * localNelz.value
})

const user_params = reactive({
  volfrac: 0.3,
  penal: 3.0,
  rmin: 1.5,
  //disp_thres: 0.5,
  tolx: 0.01,
  maxloop: 200,
  //pitch: 1.0,
  //invert_design_space: false,
})

const stlInput = ref<HTMLInputElement | null>(null)
//const uploadedStlId = ref<string | null>(null)
const uploadedStlName = ref<string | null>(null)
const isUploading = ref(false)
const scenes = ref<{ name: string; data: SavedScene }[]>([])
const selectedScene = ref('')
const sceneFiles = ['cantilever', 'beam', 'bridge', 'tower', 'table']
const material = new THREE.MeshStandardMaterial({ color: 0x3f7dbd, side: THREE.DoubleSide })
const maxStlBoundingBoxScaledVolume = 200000 //voxels, to stay under 64^3 limit
const stlScalingMatrix = ref<THREE.Matrix4>(new THREE.Matrix4())
const loadedStl = ref<THREE.Mesh | null>(null)

defineExpose({ stlScalingMatrix })

onMounted(async () => {
  const loaded = []
  for (const file of sceneFiles) {
    const res = await fetch(`/scenes/${file}.json`)
    const data = await res.json()
    loaded.push({ name: data.name, data: data })
  }
  scenes.value = loaded
})

//loads STL file saved in public folder
async function loadStlFile(fileName: string): Promise<File | null> {
  try {
    const res = await fetch(`/models/${fileName}.stl`)
    if (!res.ok) {
      console.error(`Failed to fetch STL file: ${res.statusText}`)
      return null
    }
    const blob = await res.blob()
    const stlFile = new File([blob], fileName, { type: 'model/stl' })

    return stlFile
  } catch (err) {
    console.error(`Failed to load STL file: ${err}`)
    return null
  }
}

async function selectScene() {
  clearStl()
  status.value = 'disconnected'
  const data = scenes.value.find((s) => s.name === selectedScene.value)?.data
  if (!data) return
  localNelx.value = data.nelx
  localNely.value = data.nely
  localNelz.value = data.nelz
  user_params.volfrac = data.volfrac
  user_params.penal = data.penal
  user_params.rmin = data.rmin
  user_params.tolx = data.tolx
  user_params.maxloop = data.maxloop
  user_params.maxloop = data.maxloop
  // user_params.pitch = data.pitch
  // user_params.invert_design_space = data.invert_design_space
  if (data.stlFile) {
    const stlFile = await loadStlFile(data.stlFile)
    if (stlFile) {
      await loadSTL(stlFile)
      if (loadedStl.value) {
        emit('loadStlScene', data, loadedStl.value)
        return
      }
    }
  }
  emit('loadScene', data)
}

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
  //uploadedStlId.value = null
  uploadedStlName.value = null
  try {
    await loadSTL(file)
    emit('stlLoaded', loadedStl.value!)
    //const stlId = await uploadSTL(file)
    // uploadedStlId.value = stlId
    // uploadedStlName.value = file.name
    // console.log('STL uploaded, ID:', stlId)
  } catch (err) {
    console.error('Upload failed', err)
    // alert('Failed to upload STL file')
  } finally {
    // isUploading.value = false
    // input.value = ''
  }
}

function clearStl() {
  //remove old STL (if any)
  if (!props.scene) return
  if (loadedStl.value) {
    console.log('removing stl')
    if (loadedStl.value.parent) {
      loadedStl.value.parent.remove(loadedStl.value)
    } else if (props.scene) {
      props.scene.remove(loadedStl.value)
    }
    loadedStl.value.geometry?.dispose()
    if (Array.isArray(loadedStl.value.material)) {
      loadedStl.value.material.forEach((material) => material.dispose())
    } else {
      loadedStl.value.material?.dispose()
    }
    loadedStl.value = null
    props.renderer?.render(props.scene!, props.camera!)
  }
  stlScalingMatrix.value.identity()
}

async function loadSTL(file: File) {
  console.log('importing STL file')
  if (!props.scene) {
    console.error('scene is null')
    return
  }
  clearStl()

  const buffer = await file.arrayBuffer()
  let mesh: THREE.Mesh
  try {
    const geometry = new STLLoader().parse(buffer)
    mesh = new THREE.Mesh(geometry, material)
  } catch (err) {
    console.error('Parsing failed', err)
    return
  }

  //build index array for triangles
  const positions = mesh.geometry.getAttribute('position').array
  console.log('number of verts: ', positions.length)
  if (positions.length % 3 !== 0) {
    console.error('Invalid number of vertices in input mesh. Is it triangulated?')
    return
  }
  const indices = new Array<number>()
  for (let i = 0; i < positions.length; i++) indices.push(i)
  mesh.geometry.setIndex(indices)

  // Compute bounding box of the raw mesh (local coordinates)
  const box = new THREE.Box3().setFromObject(mesh)
  const size = new THREE.Vector3()
  box.getSize(size)
  const volume = size.x * size.y * size.z
  const targetVolume = maxStlBoundingBoxScaledVolume
  const scaleFactor = Math.pow(targetVolume / volume, 1 / 3)

  // Get the original min corner directly from the box
  const minCorner = box.min.clone()

  // Translation: after scaling, we want the new min corner to be at (1,1,1)
  // (leaving 1 voxel margin from the origin)
  const translation = new THREE.Vector3(
    1 - minCorner.x * scaleFactor,
    1 - minCorner.y * scaleFactor,
    1 - minCorner.z * scaleFactor,
  )

  // Build transformation matrix: scale then translate
  stlScalingMatrix.value.compose(
    translation,
    new THREE.Quaternion(),
    new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor),
  )

  mesh.geometry.applyMatrix4(stlScalingMatrix.value)

  //If the geometry has normals, they also need to be transformed (non-uniform scale may require special handling)
  if (mesh.geometry.attributes.normal) {
    // Use the normal matrix (inverse transpose of the 3x3 world matrix) for correct normal transformation
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrix)
    const normals = mesh.geometry.attributes.normal.array
    for (let i = 0; i < normals.length; i += 3) {
      const nx = normals[i]
      const ny = normals[i + 1]
      const nz = normals[i + 2]
      const transformed = new THREE.Vector3(nx, ny, nz).applyMatrix3(normalMatrix).normalize()
      normals[i] = transformed.x
      normals[i + 1] = transformed.y
      normals[i + 2] = transformed.z
    }
    mesh.geometry.attributes.normal.needsUpdate = true
  }

  //Optionally recompute bounding sphere / box for culling and raycasting
  mesh.geometry.computeBoundingSphere()
  mesh.geometry.computeBoundingBox()

  // // Reset the mesh's local transform
  // mesh.position.set(0, 0, 0)
  // mesh.rotation.set(0, 0, 0)
  // mesh.scale.set(1, 1, 1)
  // mesh.updateMatrix() // ensure the matrix is immediately updated

  // mesh.matrix.copy(stlScalingMatrix)
  // mesh.matrixAutoUpdate = false // Prevent Three.js from overwriting the matrix

  // Compute new grid dimensions
  const scaledSize = size.clone().multiplyScalar(scaleFactor)
  const nX = Math.ceil(scaledSize.x) + 2 // +2 for padding on both sides
  const nY = Math.ceil(scaledSize.y) + 2
  const nZ = Math.ceil(scaledSize.z) + 2

  //props.scene.add(mesh)
  loadedStl.value = mesh

  // Update grid dimensions (this will trigger re‑voxelization)
  localNelx.value = nX
  localNely.value = nY
  localNelz.value = nZ
  console.log('imported STL mesh')
  // Optionally emit an event that the STL is loaded and scaled
  //emit('stlLoaded', mesh)
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
    //pitch: user_params.pitch,
    //invert_design_space: user_params.invert_design_space,
    //design_space_stl_id: uploadedStlId.value,
  })
}

function stop() {
  emit('stop')
}

function saveResults() {
  emit('saveResults')
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

/* .loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
} */

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 1.5s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
