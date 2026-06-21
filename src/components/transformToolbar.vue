<template>
  <div v-if="toolbarVisible" class="toolbar" @mousedown.stop @click.stop @mousemove.stop>
    <label class="toolbar-label">{{ selectedCategory }}</label>
    <div class="button-container">
      <button
        class="transparent-btn"
        @click="setMode('translate')"
        :class="{ active: currentMode === 'translate' }"
      >
        <img src="@/assets/icons/move.png" />
      </button>
      <span class="button-hint">Move Object</span>
    </div>
    <div class="button-container">
      <button
        class="transparent-btn"
        @click="setMode('rotate')"
        :class="{ active: currentMode === 'rotate' }"
      >
        <img src="@/assets/icons/rotate.png" />
      </button>
      <span class="button-hint">Rotate Object</span>
    </div>
    <div class="button-container">
      <button
        class="transparent-btn"
        @click="setMode('scale')"
        :class="{ active: currentMode === 'scale' }"
      >
        <img src="@/assets/icons/scale.png" />
      </button>
      <span class="button-hint">Scale Object</span>
    </div>
    <div v-if="isForceSelected" class="force-tools">
      <div class="button-container">
        <button class="transparent-btn" @click="modifyForces()">
          <img src="@/assets/icons/forces.png" />
        </button>
        <span class="button-hint">Modify Forces</span>
      </div>
      <div v-if="modifyingForces" class="button-container">
        <button
          @click="setMode('force_rotate')"
          :class="{ active: currentMode === 'force_rotate' }"
        >
          Change Force Direction
        </button>
        <span class="button-hint">Change Force Direction</span>
      </div>
      <div v-if="modifyingForces">
        <label>Force Strength: </label>
        <input type="range" v-model.number="forceMagnitude" step="0.1" min="0.1" max="10.0" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, unref, computed, watch, inject } from 'vue'
import type { ShallowRef } from 'vue'
import { useSceneObjects } from '@/composables/useSceneObjects'

const sceneObjects = inject<ShallowRef<ReturnType<typeof useSceneObjects> | null>>('sceneObjects')
const selectedCategory = computed(() => {
  return sceneObjects?.value?.selectedObj.value?.category
})
const emit = defineEmits(['mode-change', 'force-strength-change'])

const forceMagnitude = ref(1)
let ignoreForceWatch = false
const toolbarVisible = computed(() => {
  return sceneObjects?.value?.selectedId.value !== null
})

const currentMode = ref('translate')
//const toolbarOffset = 50
const isForceSelected = computed(() => {
  if (!sceneObjects?.value) return false
  const obj = sceneObjects.value.objects.value.find(
    (o) => o.id === sceneObjects?.value?.selectedId?.value,
  )
  return obj?.category === 'force'
})
const modifyingForces = ref(false)

function selectObject() {
  console.log('select')
  if (!sceneObjects?.value?.selectedId) {
    //toolbarVisible.value = false
    modifyingForces.value = false
    if (forceMagnitude.value === 1.0) return
    ignoreForceWatch = true
    forceMagnitude.value = 1.0
    ignoreForceWatch = false
    return
  }

  const obj = sceneObjects.value.selectedObj
  const category = unref(sceneObjects.value.selectedObj.value?.category)
  console.log('category ', category)
  if (!obj) {
    //toolbarVisible.value = false
    modifyingForces.value = false
    return
  }
  //toolbarVisible.value = true
  if (category !== 'force') return
  const len = unref(sceneObjects.value.selectedObj.value?.forceVector?.length())
  if (!len) return
  ignoreForceWatch = true
  console.log('length', len)
  forceMagnitude.value = len
  ignoreForceWatch = false
}

function setMode(mode: string) {
  currentMode.value = mode
  emit('mode-change', mode)
}

function modifyForces() {
  modifyingForces.value = !modifyingForces.value
  console.log('modify forces: ', modifyingForces.value)
}

watch(forceMagnitude, (newval) => {
  if (ignoreForceWatch) return
  emit('force-strength-change', newval)
})

watch(
  () => sceneObjects?.value?.selectedObj?.value,
  () => {
    selectObject()
  },
)
</script>

<style scoped>
.toolbar {
  top: 50%; /* move top edge to vertical center */
  right: 0; /* stick to right edge */
  transform: translateY(-50%); /* shift up by half its own height */
  flex-direction: column; /* arrange buttons vertically */
  border-radius: 8px 0 0 8px;
}
</style>
