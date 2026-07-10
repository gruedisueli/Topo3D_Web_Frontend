<template>
  <!-- <div class="title-block">
    <h1>3DStructTopoOpt</h1>
  </div> -->
  <div class="main-container">
    <div class="toolbar" @mousedown.stop @click.stop @mousemove.stop>
      <IconButton
        :activated="startStopTabOpen"
        @clicked="clickStartStop()"
        :image-src="StartStopIcon"
      ></IconButton>
      <IconButton
        :activated="addRemoveTabOpen"
        @clicked="clickAddRemove()"
        :image-src="AddRemoveIcon"
      ></IconButton>
      <IconButton
        :activated="loadTabOpen"
        @clicked="clickLoad()"
        :image-src="OpenIcon"
      ></IconButton>
      <IconButton
        :activated="dimensionsTabOpen"
        @clicked="clickDimensions()"
        :image-src="DimensionIcon"
      ></IconButton>
      <IconButton
        :activated="advancedTabOpen"
        @clicked="clickAdvanced()"
        :image-src="AdvancedIcon"
      ></IconButton>
      <IconButton
        :activated="visibilityTabOpen"
        @clicked="clickVisibility()"
        :image-src="VisibilityIcon"
      ></IconButton>
      <IconButton
        :activated="infoTabOpen"
        @clicked="clickInfo()"
        :image-src="InfoIcon"
      ></IconButton>
      <IconButton @clicked="$emit('undo')" :image-src="UndoIcon"></IconButton>
      <IconButton @clicked="$emit('redo')" :image-src="RedoIcon"></IconButton>
      <IconButton @clicked="$emit('clone')" :image-src="CloneIcon"></IconButton>
      <IconButton @clicked="$emit('update:fullscreen')" :image-src="FullscreenIcon"></IconButton>
    </div>
    <div class="tab-container" v-if="tabOpen">
      <div class="tab start" v-if="startStopTabOpen" @mousedown.stop @click.stop @mousemove.stop>
        <button class="simple-button" @click="start" v-if="!optimizerRunning">Start</button>
        <button class="simple-button" @click="stop" v-if="optimizerRunning">Stop</button>
        <div
          v-if="
            optimizer?.status.value !== 'disconnected' && optimizer?.status.value !== 'complete'
          "
        >
          <ProgressBar
            :value="
              optimizer ? Math.floor((optimizer?.iterationCt.value / user_params.maxloop) * 100) : 0
            "
            :indeterminate="optimizer?.status.value !== 'running'"
            :status="optimizer?.status.value"
          />
        </div>
        <div class="form-group">
          <button
            class="simple-button"
            v-if="optimizer?.status.value === 'complete'"
            @click="saveResults"
            :disabled="optimizer?.status.value !== 'complete'"
          >
            Save Results STL
          </button>
        </div>
      </div>
      <div class="tab" v-if="dimensionsTabOpen" @mousedown.stop @click.stop @mousemove.stop>
        <div class="form-group">
          <span class="form-group-left">
            <label class="toolbar-label">Grid X: </label>
            <input
              class="input-field"
              type="number"
              v-model.number="localNelx"
              min="5"
              :max="maxNelx"
              :disabled="optimizerRunning"
              @blur="clampX"
            />
          </span>
          <label class="toolbar-label r-aligned"> Calculated X Max: {{ maxNelx }}</label>
        </div>
        <div class="form-group">
          <span class="form-group-left">
            <label class="toolbar-label">Grid Y: </label>
            <input
              class="input-field"
              type="number"
              v-model.number="localNely"
              min="5"
              :max="maxNely"
              :disabled="optimizerRunning"
              @blur="clampY"
            />
          </span>
          <label class="toolbar-label r-aligned"> Calculated Y Max: {{ maxNely }}</label>
        </div>
        <div class="form-group">
          <span class="form-group-left">
            <label class="toolbar-label">Grid Z: </label>
            <input
              class="input-field"
              type="number"
              v-model.number="localNelz"
              min="5"
              :max="maxNelz"
              :disabled="optimizerRunning"
              @blur="clampZ"
            />
          </span>
          <label class="toolbar-label r-aligned"> Calculated Z Max: {{ maxNelz }}</label>
        </div>
        <div class="form-group">
          <label class="toolbar-label r-aligned">Current Voxel Count: {{ voxelCt }}</label>
        </div>
        <div class="form-group">
          <label class="toolbar-label r-aligned">Max Voxel Count: {{ maxVolume }}</label>
        </div>
      </div>
      <div class="tab" v-if="loadTabOpen" @mousedown.stop @click.stop @mousemove.stop>
        <span class="form-group-left">
          <label class="toolbar-label">Load Preset Scene: </label>
          <select
            class="selection-box"
            :disabled="optimizerRunning"
            v-model="selectedScene"
            @change="selectScene"
          >
            <option v-for="scene in scenes" :key="scene.name" :value="scene.name">
              {{ scene.name }}
            </option>
          </select>
        </span>
        <div class="form-group">
          <!-- <label>Design Space STL (optional)</label> -->
          <input
            type="file"
            ref="stlInput"
            accept=".stl"
            @change="handleFileSelect"
            style="display: none"
          />
          <button class="simple-button" :disabled="optimizerRunning" @click="triggerFilePicker">
            Import STL File
          </button>
          <span v-if="uploadedStlName">{{ uploadedStlName }} (uploaded)</span>
        </div>
      </div>
      <div class="tab" v-if="advancedTabOpen" @mousedown.stop @click.stop @mousemove.stop>
        <span class="form-group-left">
          <label class="toolbar-label">Volume Fraction: {{ user_params.volfrac }}</label>
          <input
            class="slider"
            type="range"
            :disabled="optimizerRunning"
            v-model.number="user_params.volfrac"
            min="0.1"
            max="0.9"
            step="0.1"
          />
        </span>
        <span class="form-group-left">
          <label class="toolbar-label">Penalization: {{ user_params.penal }}</label>
          <input
            class="slider"
            type="range"
            :disabled="optimizerRunning"
            v-model.number="user_params.penal"
            min="1.0"
            max="4.0"
            step="0.1"
          />
        </span>
        <span class="form-group-left">
          <label class="toolbar-label">Filter Radius: </label>
          <input
            class="input-field"
            type="number"
            :disabled="optimizerRunning"
            v-model.number="user_params.rmin"
            step="0.5"
          />
        </span>
        <span class="form-group-left">
          <label class="toolbar-label">Autorotate On Idle</label>
          <input
            type="checkbox"
            @click="$emit('update:autorotate', !autorotate)"
            :checked="autorotate"
          />
        </span>
      </div>
      <div class="tab" v-if="addRemoveTabOpen" @mousedown.stop @click.stop @mousemove.stop>
        <IconButton
          @clicked="add('support')"
          :image-src="SupportIcon"
          text="Add Support"
        ></IconButton>
        <IconButton @clicked="add('force')" :image-src="ForceIcon" text="Add Force"></IconButton>
        <IconButton
          @clicked="add('obstacle')"
          :image-src="ObstacleIcon"
          text="Add Void"
        ></IconButton>
        <IconButton
          @clicked="$emit('remove')"
          :image-src="DeleteIcon"
          text="Delete Selected"
        ></IconButton>
      </div>
      <div class="tab" v-if="visibilityTabOpen" @mousedown.stop @click.stop @mousemove.stop>
        <span class="form-group-left">
          <input
            type="checkbox"
            @click="$emit('update:designSpaceVisible', !designSpaceVisible)"
            :checked="designSpaceVisible"
          />
          <label class="toolbar-label">Design Space</label>
        </span>
        <span class="form-group-left">
          <input
            type="checkbox"
            @click="$emit('update:designConditionsVisible', !designConditionsVisible)"
            :checked="designConditionsVisible"
          />
          <label class="toolbar-label">Design Conditions</label>
        </span>
        <span class="form-group-left">
          <input
            type="checkbox"
            @click="$emit('update:resultsVoxelFieldVisible', !resultsVoxelFieldVisible)"
            :checked="resultsVoxelFieldVisible"
          />
          <label class="toolbar-label">Results Density Field</label>
        </span>
        <span class="form-group-left">
          <input
            type="checkbox"
            @click="$emit('update:resultsMeshVisible', !resultsMeshVisible)"
            :checked="resultsMeshVisible"
          />
          <label class="toolbar-label">Results Mesh</label>
        </span>
      </div>
      <div class="tab" v-if="infoTabOpen" @mousedown.stop @click.stop @mousemove.stop>
        <button class="simple-button" @click="openHelpMenu()">Help</button>
        <p class="info-text">
          This is an app for 3D structural topology optimization. You can find more information
          about how to use the app in the help section.
        </p>
        <p class="info-text">
          The frontend of the app is running using Vue.js and Three.js. Here is a link to the
          <a href="https://github.com/gruedisueli/Topo3D_Web_Frontend" target="_blank"
            >frontend repository</a
          >. Voxelized data is transmitted to a backend GPU-enabled server for processing, and code
          can be found in my
          <a href="https://github.com/gruedisueli/Topo3D_Web_Backend" target="_blank"
            >backend repository</a
          >. The optimizer itself is a
          <a href="https://github.com/gruedisueli/PyTopo3D_Backend/tree/dev" target="_blank"
            >fork</a
          >
          of the
          <a href="https://github.com/jihoonkim888/PyTopo3D" target="_blank">PyTopo3d repository</a
          >. Your imported STLs are not transmitted to the backend and remain on your machine. Only
          voxelized data is transmitted.
        </p>
        <p class="info-text">
          You can view more of my work at
          <a href="https://gavinruedisueli.com" target="_blank">gavinruedisueli.com</a>. If you
          would like to contact me, please email me at gavin@gavinruedisueli.com
        </p>
      </div>
    </div>
  </div>
  <HelpMenu v-model:open="helpMenuOpen"></HelpMenu>
</template>

<script setup lang="ts">
import { reactive, watch, ref, onMounted, computed, inject } from 'vue'
import type { Ref } from 'vue'
import { useOptimization } from '@/composables/useOptimization'
import { useSceneObjects } from '@/composables/useSceneObjects'
import type { SavedScene } from '@/types/scene'
import { STLLoader } from 'three/examples/jsm/Addons.js'
import * as THREE from 'three'
import type { ShallowRef } from 'vue'
import ProgressBar from './progressBar.vue'
import type { ObjectCategory } from '@/types/editor'
import HelpMenu from './helpMenu.vue'
import IconButton from './iconButton.vue'
import SupportIcon from '@/assets/icons/support.svg'
import ForceIcon from '@/assets/icons/force.svg'
import ObstacleIcon from '@/assets/icons/obstacle.svg'
import DeleteIcon from '@/assets/icons/delete.svg'
import AddRemoveIcon from '@/assets/icons/add-remove.svg'
import AdvancedIcon from '@/assets/icons/gear.svg'
import VisibilityIcon from '@/assets/icons/eye.svg'
import InfoIcon from '@/assets/icons/info.svg'
import OpenIcon from '@/assets/icons/folder.svg'
import DimensionIcon from '@/assets/icons/dimensions.svg'
import StartStopIcon from '@/assets/icons/play-stop.svg'
import FullscreenIcon from '@/assets/icons/fullscreen.svg'
import UndoIcon from '@/assets/icons/undo.svg'
import RedoIcon from '@/assets/icons/redo.svg'
import CloneIcon from '@/assets/icons/clone.svg'

const scene = inject<ShallowRef<THREE.Scene | null>>('scene')
const camera = inject<ShallowRef<THREE.PerspectiveCamera | null>>('camera')
const renderer = inject<ShallowRef<THREE.WebGLRenderer | null>>('renderer')
const optimizer = inject<ReturnType<typeof useOptimization> | null>('optimizer')
const sceneObjects = inject<Ref<ReturnType<typeof useSceneObjects> | null>>('sceneObjects')

const optimizerRunning = computed(() => {
  return optimizer?.status.value !== 'disconnected' && optimizer?.status.value !== 'complete'
})

defineProps<{
  autorotate: boolean
  designSpaceVisible: boolean
  designConditionsVisible: boolean
  resultsMeshVisible: boolean
  resultsVoxelFieldVisible: boolean
}>()

const emit = defineEmits<{
  (e: 'start', params: Record<string, unknown>): void
  (e: 'stop'): void
  (e: 'update:dimensions', dims: { nelx: number; nely: number; nelz: number }): void
  (e: 'loadScene', scene: SavedScene): void
  (e: 'loadStlScene', scene: SavedScene, mesh: THREE.Mesh): void
  (e: 'stlLoaded', stl: THREE.Mesh): void
  (e: 'saveResults'): void
  (e: 'update:scaling-matrix', matrix: THREE.Matrix4): void
  (e: 'update:autorotate', value: boolean): void
  (e: 'update:designSpaceVisible', value: boolean): void
  (e: 'update:designConditionsVisible', value: boolean): void
  (e: 'update:resultsMeshVisible', value: boolean): void
  (e: 'update:resultsVoxelFieldVisible', value: boolean): void
  (e: 'update:fullscreen'): void
  (e: 'undo'): void
  (e: 'redo'): void
  (e: 'remove'): void
  (e: 'clone'): void
}>()

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

function clampX() {
  if (localNelx.value < 5) localNelx.value = 5
  else if (localNelx.value > maxNelx.value) localNelx.value = maxNelx.value
}

function clampY() {
  if (localNely.value < 5) localNely.value = 5
  else if (localNely.value > maxNely.value) localNely.value = maxNely.value
}

function clampZ() {
  if (localNelz.value < 5) localNelz.value = 5
  else if (localNelz.value > maxNelz.value) localNelz.value = maxNelz.value
}

const user_params = reactive({
  volfrac: 0.3,
  penal: 3.0,
  rmin: 1.5,
  tolx: 0.01,
  maxloop: 200,
})

const stlInput = ref<HTMLInputElement | null>(null)
const uploadedStlName = ref<string | null>(null)
const isUploading = ref(false)
const scenes = ref<{ name: string; data: SavedScene }[]>([])
const selectedScene = ref('cantilever')
const sceneFiles = ['cantilever', 'beam', 'bridge', 'tower', 'table']
const material = new THREE.MeshStandardMaterial({ color: 0x3f7dbd, side: THREE.DoubleSide })
const maxStlBoundingBoxScaledVolume = 200000 //voxels, to stay under 64^3 limit
const stlScalingMatrix = ref<THREE.Matrix4>(new THREE.Matrix4())
const loadedStl = ref<THREE.Mesh | null>(null)
const startStopTabOpen = ref(true)
const dimensionsTabOpen = ref(false)
const loadTabOpen = ref(false)
const advancedTabOpen = ref(false)
const infoTabOpen = ref(false)
const addRemoveTabOpen = ref(false)
const visibilityTabOpen = ref(false)
const helpMenuOpen = ref(false)
const tabStatuses = [
  startStopTabOpen,
  dimensionsTabOpen,
  loadTabOpen,
  advancedTabOpen,
  infoTabOpen,
  addRemoveTabOpen,
  visibilityTabOpen,
]

onMounted(async () => {
  const loaded = []
  for (const file of sceneFiles) {
    const res = await fetch(`./scenes/${file}.json`)
    const data = await res.json()
    loaded.push({ name: data.name, data: data })
  }
  scenes.value = loaded
  selectedScene.value = 'Cantilever'
  await selectScene()
})

const tabOpen = computed(() => {
  return (
    startStopTabOpen.value ||
    dimensionsTabOpen.value ||
    loadTabOpen.value ||
    addRemoveTabOpen.value ||
    advancedTabOpen.value ||
    visibilityTabOpen.value ||
    infoTabOpen.value
  )
})

const add = (category: ObjectCategory) => {
  sceneObjects?.value?.addObject(category, 'cube')
}

function closeAllOtherTabs(currentTab: Ref<boolean>) {
  for (const tab of tabStatuses) {
    if (tab === currentTab) continue
    tab.value = false
  }
}

function clickStartStop() {
  closeAllOtherTabs(startStopTabOpen)
  startStopTabOpen.value = !startStopTabOpen.value
}

function clickDimensions() {
  closeAllOtherTabs(dimensionsTabOpen)
  dimensionsTabOpen.value = !dimensionsTabOpen.value
}

function clickLoad() {
  closeAllOtherTabs(loadTabOpen)
  loadTabOpen.value = !loadTabOpen.value
}

function clickAdvanced() {
  closeAllOtherTabs(advancedTabOpen)
  advancedTabOpen.value = !advancedTabOpen.value
}

function clickInfo() {
  closeAllOtherTabs(infoTabOpen)
  infoTabOpen.value = !infoTabOpen.value
}

function clickVisibility() {
  closeAllOtherTabs(visibilityTabOpen)
  visibilityTabOpen.value = !visibilityTabOpen.value
}

function clickAddRemove() {
  closeAllOtherTabs(addRemoveTabOpen)
  addRemoveTabOpen.value = !addRemoveTabOpen.value
}

function resetScalingMatrix() {
  stlScalingMatrix.value.identity()
  emit('update:scaling-matrix', stlScalingMatrix.value)
}

function openHelpMenu() {
  helpMenuOpen.value = true
}

//loads STL file saved in public folder
async function loadStlFile(fileName: string): Promise<File | null> {
  try {
    const res = await fetch(`./models/${fileName}.stl`)
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
  if (!scene?.value || !camera?.value) return
  if (loadedStl.value) {
    console.log('removing stl')
    if (loadedStl.value.parent) {
      loadedStl.value.parent.remove(loadedStl.value)
    } else {
      scene.value.remove(loadedStl.value)
    }
    loadedStl.value.geometry?.dispose()
    if (Array.isArray(loadedStl.value.material)) {
      loadedStl.value.material.forEach((material) => material.dispose())
    } else {
      loadedStl.value.material?.dispose()
    }
    loadedStl.value = null
    renderer?.value?.render(scene.value, camera.value)
  }
  resetScalingMatrix()
}

async function loadSTL(file: File) {
  console.log('importing STL file')
  if (!scene?.value) {
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
  emit('update:scaling-matrix', stlScalingMatrix.value)

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
.main-container {
  position: fixed;
  top: 20px;
  left: 20px;
  display: flex;
  flex-direction: row;
  gap: 8px;
  background: transparent;
  padding: 12px;
  z-index: 10; /* Higher than canvas z-index */
  pointer-events: none;
  text-align: center;
  overflow-y: auto;
  max-height: calc(100vh - 40px);
  max-width: calc(100vw - 40px);
  box-sizing: border-box;
}

/* Shorter screens: scale everything down so it fits without scrolling */
@media (max-height: 700px) {
  .main-container {
    max-height: none;
    overflow-y: none;
    transform: scale(0.6);
    transform-origin: top left;
  }
}

@media (max-height: 600px) {
  .main-container {
    max-height: none;
    overflow-y: none;
    transform: scale(0.5);
    transform-origin: top left;
  }
}

@media (max-height: 480px) {
  .main-container {
    max-height: none;
    overflow-y: none;
    transform: scale(0.4);
    transform-origin: top left;
  }
}

@media (max-height: 380px) {
  .main-container {
    max-height: none;
    overflow-y: none;
    transform: scale(0.4);
    transform-origin: top left;
  }
}

.main-container::-webkit-scrollbar {
  width: 8px;
}

.main-container::-webkit-scrollbar-track {
  background: transparent;
}

.main-container::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25);
  border-radius: 4px;
}

.main-container::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.45);
}

.title-block {
  position: relative;
  top: 4px;
  left: 4px;
  width: 300px;
  text-align: center;
  background: none;
}

.toolbar {
  position: relative;
  flex-direction: column;
  border-radius: 8px 8px 8px 8px;
  height: fit-content;
  max-width: 300px;
}

.toolbar-label.menu {
  font-size: 18px;
  font-weight: bold;
}

.tab.start {
  width: min(300px, calc(50vw - 40px));
}

.tab-container {
  position: relative;
  flex-direction: column;
  border-radius: 8px 8px 8px 8px;
  height: fit-content;
  max-width: 300px;
  display: flex;
  gap: 10px;
  background: #333;
  padding: 12px 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  /* Higher than canvas z-index */
  text-align: center;
  pointer-events: auto;
}

.toolbar.selector {
  position: relative;
  top: 4px;
  left: 4px;
  flex-direction: row;
  transform: none;
  border-radius: 8px 8px 8px 8px;
}

.transparent-btn.expander {
  padding: 0px;
}

.selection-box {
  border-radius: 4px;
  font-family: 'Segoe UI', Verdana, Geneva, Tahoma, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: black;
  letter-spacing: 0.5px;
  height: 30px;
  margin-left: auto;
}

.tab {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: auto;
}

.form-group-left {
  display: flex;
  /* align-items: left; */
  gap: 8px;
}

.input-field {
  width: 50px;
}

.slider {
  margin-left: auto;
  align-items: right;
}

.spacer {
  margin-left: auto;
}

.toolbar-label.r-aligned {
  margin-left: auto;
  text-align: right;
}

.toolbar.region {
  position: relative;
  top: 4px;
  left: 4px;
  width: 300px;
  flex-direction: column;
  transform: none;
  border-radius: 8px 8px 8px 8px;
  text-align: left;
}

.expander-button {
  background-color: transparent;
  border-color: white;
  border-radius: 4px;
  border-width: 3px;
  font-family: 'Segoe UI', Verdana, Geneva, Tahoma, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
  letter-spacing: 0.5px;
  height: 30px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 1.5s linear infinite;
}

.info-text {
  font-family: 'Segoe UI', Verdana, Geneva, Tahoma, sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: #e0e0e0;
  letter-spacing: 0.5px;
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
