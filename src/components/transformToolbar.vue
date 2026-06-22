<template>
  <div v-if="toolbarVisible" class="toolbar" @mousedown.stop @click.stop @mousemove.stop>
    <label class="toolbar-label">{{ selectedCategory }}</label>
    <div v-if="!modifyingForces">
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

      <div class="button-container">
        <button
          class="transparent-btn"
          :class="{ activated: sceneObjects?.selectedObj.value?.primitive === 'cube' }"
          @click="setPrimitive('cube')"
        >
          <img src="@/assets/icons/cube.svg" width="48px" height="48px" />
        </button>
        <span class="button-hint">Region: Cube</span>
      </div>
      <div class="button-container">
        <button
          class="transparent-btn"
          :class="{ activated: sceneObjects?.selectedObj.value?.primitive === 'cylinder' }"
          @click="setPrimitive('cylinder')"
        >
          <img src="@/assets/icons/cylinder.svg" width="48px" height="48px" />
        </button>
        <span class="button-hint">Region: Cylinder</span>
      </div>
      <div class="button-container">
        <button
          class="transparent-btn"
          :class="{ activated: sceneObjects?.selectedObj.value?.primitive === 'sphere' }"
          @click="setPrimitive('sphere')"
        >
          <img src="@/assets/icons/sphere.svg" width="48px" height="48px" />
        </button>
        <span class="button-hint">Region: Sphere</span>
      </div>
    </div>
    <div v-if="isForceSelected" class="force-tools">
      <div class="button-container">
        <button
          class="transparent-btn"
          :class="{ activated: modifyingForces }"
          @click="modifyForces()"
        >
          <img src="@/assets/icons/forces.png" />
        </button>
        <span class="button-hint">Modify Forces</span>
      </div>
      <div v-if="modifyingForces">
        <div class="button-container">
          <button @click="setMode('force_rotate')" class="simple-button">
            Set Custom Direction
          </button>
          <span class="button-hint">Change Force Direction</span>
        </div>
        <label class="toolbar-label">Preset Directions</label>
        <div class="grid-container">
          <div class="grid-item" width="30px" height="30px"></div>
          <div class="grid-item">
            <button class="transparent-btn uninverted" @click="setForceDir('posY')">
              <img src="@/assets/icons/posY.svg" width="30px" height="30px" />
            </button>
          </div>
          <div class="grid-item">
            <button class="transparent-btn uninverted" @click="setForceDir('posZ')">
              <img src="@/assets/icons/posZ.svg" width="30px" height="30px" />
            </button>
          </div>
          <div class="grid-item">
            <button class="transparent-btn uninverted" @click="setForceDir('negX')">
              <img src="@/assets/icons/negX.svg" width="30px" height="30px" />
            </button>
          </div>
          <div class="grid-item">
            <img src="@/assets/icons/axes.svg" width="30px" height="30px" />
          </div>
          <div class="grid-item">
            <button class="transparent-btn uninverted" @click="setForceDir('posX')">
              <img src="@/assets/icons/posX.svg" width="30px" height="30px" />
            </button>
          </div>
          <div class="grid-item">
            <button class="transparent-btn uninverted" @click="setForceDir('negZ')">
              <img src="@/assets/icons/negZ.svg" width="30px" height="30px" />
            </button>
          </div>
          <div class="grid-item">
            <button class="transparent-btn uninverted" @click="setForceDir('negY')">
              <img src="@/assets/icons/negY.svg" width="30px" height="30px" />
            </button>
          </div>
          <div class="grid-item" width="30px" height="30px"></div>
        </div>
        <label class="toolbar-label">Strength</label>
        <div>
          <input
            type="range"
            orient="vertical"
            v-model.number="forceMagnitude"
            step="0.1"
            min="0.1"
            max="10.0"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, unref, computed, watch, inject } from 'vue'
import type { ShallowRef } from 'vue'
import { useSceneObjects } from '@/composables/useSceneObjects'
import type { PrimitiveType } from '@/types/editor'

const sceneObjects = inject<ShallowRef<ReturnType<typeof useSceneObjects> | null>>('sceneObjects')
const selectedCategory = computed(() => {
  return sceneObjects?.value?.selectedObj.value?.category !== 'obstacle'
    ? sceneObjects?.value?.selectedObj.value?.category
    : 'keepout'
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

function setPrimitive(primitive: PrimitiveType) {
  sceneObjects?.value?.changeSelectedPrimitive(primitive)
}

function reset() {
  modifyingForces.value = false
  if (forceMagnitude.value === 1.0) return
  ignoreForceWatch = true
  forceMagnitude.value = 1.0
  ignoreForceWatch = false
}

function selectObject() {
  if (!sceneObjects?.value?.selectedId) {
    reset()
    return
  }

  const obj = sceneObjects.value.selectedObj
  const category = unref(sceneObjects.value.selectedObj.value?.category)
  if (!obj) {
    modifyingForces.value = false
    return
  }
  if (category !== 'force') return
  const len = unref(sceneObjects.value.selectedObj.value?.forceVector?.length())
  if (!len) return
  ignoreForceWatch = true
  forceMagnitude.value = len
  ignoreForceWatch = false
}

function setMode(mode: string) {
  currentMode.value = mode
  emit('mode-change', mode)
}

function modifyForces() {
  modifyingForces.value = !modifyingForces.value
  sceneObjects?.value?.removeControls()
  sceneObjects?.value?.showHideForceControls(modifyingForces.value)
}

function setForceDir(dir: string) {
  sceneObjects?.value?.setForceDir(dir)
}

watch(forceMagnitude, (newval) => {
  if (ignoreForceWatch) return
  emit('force-strength-change', newval)
})

watch(toolbarVisible, (visible) => {
  if (!visible) reset()
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
  text-align: center;
}

.transparent-btn.uninverted {
  filter: none;
}

.grid-container {
  display: grid;
  /* Define 3 columns of equal width (using the fractional unit 'fr') */
  grid-template-columns: repeat(3, 1fr);
  gap: 0px;
}

input[type='range'] {
  /* Modern Standard (Chrome, Safari, Edge, Firefox) */
  writing-mode: vertical-lr;
  direction: rtl; /* Ensures sliding UP increases the value */

  /* Fallback for older WebKit/Chrome versions */
  appearance: slider-vertical;
  -webkit-appearance: slider-vertical;

  /* Layout alignment fixes */
  width: 16px;
  height: 150px;
  vertical-align: bottom;
}
</style>
