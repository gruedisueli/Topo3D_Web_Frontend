<template>
  <div class="transform-toolbar" :style="toolbarStyle">
    <button @click="setMode('translate')" :class="{ active: currentMode === 'translate' }">
      Move
    </button>
    <button @click="setMode('rotate')" :class="{ active: currentMode === 'rotate' }">Rotate</button>
    <button @click="setMode('scale')" :class="{ active: currentMode === 'scale' }">Scale</button>
    <button
      @click="setMode('force_rotate')"
      v-show="isForceSelected"
      :class="{ active: currentMode === 'force_rotate' }"
    >
      Change Force Direction
    </button>
    <div v-show="isForceSelected">
      <label>Force Strength: </label>
      <input type="range" v-model.number="forceMagnitude" step="0.1" min="0.1" max="10.0" />
    </div>
  </div>
</template>

<script setup lang="ts">
import * as THREE from 'three'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import type { PropType } from 'vue'
import { useSceneObjects } from '@/composables/useSceneObjects'

const props = defineProps({
  sceneObjects: Object as PropType<ReturnType<typeof useSceneObjects> | null>,
  selectedMesh: Object as PropType<THREE.Object3D | null>,
  camera: Object as PropType<THREE.Camera | null>,
  renderer: Object as PropType<THREE.WebGLRenderer | null>,
})
const emit = defineEmits(['mode-change', 'force-strength-change'])
defineExpose({ selectObject })
const forceMagnitude = ref(1)
let ignoreForceWatch = false

const currentMode = ref('translate')
const toolbarOffset = 50
const isForceSelected = computed(() => {
  if (!props.sceneObjects) return false
  const obj = props.sceneObjects.objects.value.find(
    (o) => o.id === props.sceneObjects?.selectedId?.value,
  )
  return obj?.category === 'force'
})

const toolbarStyle = ref({
  position: 'absolute',
  top: '0px',
  left: '0px',
  display: 'flex',
})
let animationId: number | null = null

function selectObject() {
  if (!props.sceneObjects?.selectedId.value) {
    if (forceMagnitude.value === 1.0) return
    ignoreForceWatch = true
    forceMagnitude.value = 1.0
    ignoreForceWatch = false
    return
  }
  const obj = props.sceneObjects.objects.value.find(
    (o) => o.id === props.sceneObjects!.selectedId.value,
  )
  if (!obj) return
  if (obj.category != 'force' || !obj.forceVector) return
  ignoreForceWatch = true
  console.log('length', obj.forceVector.length())
  forceMagnitude.value = obj.forceVector.length()
  ignoreForceWatch = false
}

function updatePosition() {
  if (!props.selectedMesh || !props.camera || !props.renderer) {
    toolbarStyle.value = {
      position: 'absolute',
      top: '0px',
      left: '0px',
      display: 'flex',
    }
    return
  }
  //projects to camera's "normalized device coordinate":
  //-1 to +1 range
  const vector = props.selectedMesh.position.clone().project(props.camera!)
  //map the x vector to the 0 to 1 range and get pixel coord
  const x = (vector.x * 0.5 + 0.5) * props.renderer!.domElement.clientWidth
  //in NDC, y = -1 is bottom, but in HTML/CSS screen coordinates, y=0 is top
  //map the reverse y vector to the 0 to 1 range and get pixel coord
  const y = (-vector.y * 0.5 + 0.5) * props.renderer!.domElement.clientHeight
  toolbarStyle.value = {
    position: 'absolute',
    top: `${y - toolbarOffset}px`,
    left: `${x - toolbarOffset}px`,
    display: 'flex',
  }
}

function startUpdating() {
  if (animationId) cancelAnimationFrame(animationId)
  function frame() {
    updatePosition()
    animationId = requestAnimationFrame(frame)
  }
  frame()
}

function setMode(mode: string) {
  currentMode.value = mode
  emit('mode-change', mode)
}

onMounted(() => {
  startUpdating()
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
})

watch(
  () => props.selectedMesh,
  () => updatePosition(),
  { immediate: true },
)
watch(
  () => props.camera,
  () => updatePosition(),
)
watch(
  () => props.renderer,
  () => updatePosition(),
)
watch(forceMagnitude, (newval) => {
  if (ignoreForceWatch) return
  emit('force-strength-change', newval)
})
</script>
