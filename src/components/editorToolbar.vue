<template>
  <div class="toolbar" @mousedown.stop @click.stop @mousemove.stop>
    <div class="subregion">
      <label class="toolbar-label">Mode Selector</label>
      <div class="toolbar selector">
        <div class="button-container">
          <button
            class="transparent-btn"
            :class="{ activated: primitive === 'cube' }"
            @click="setPrimitive('cube')"
          >
            <img src="@/assets/icons/cube.svg" width="48px" height="48px" />
          </button>
          <span class="button-hint">Add Cube Mode</span>
        </div>
        <div class="button-container">
          <button
            class="transparent-btn"
            :class="{ activated: primitive === 'cylinder' }"
            @click="setPrimitive('cylinder')"
          >
            <img src="@/assets/icons/cylinder.svg" width="48px" height="48px" />
          </button>
          <span class="button-hint">Add Cylinder Mode</span>
        </div>
        <div class="button-container">
          <button
            class="transparent-btn"
            :class="{ activated: primitive === 'sphere' }"
            @click="setPrimitive('sphere')"
          >
            <img src="@/assets/icons/sphere.svg" width="48px" height="48px" />
          </button>
          <span class="button-hint">Add Sphere Mode</span>
        </div>
      </div>
    </div>
    <div class="connector">
      <label class="toolbar-label"> >>> </label>
    </div>
    <div class="subregion">
      <label class="toolbar-label">Add / Remove</label>
      <div class="toolbar selector">
        <div class="button-container">
          <button class="transparent-btn" @click="add('support')">
            <img src="@/assets/icons/support.svg" />
          </button>
          <span class="button-hint">Add Support</span>
        </div>
        <div class="button-container">
          <button class="transparent-btn" @click="add('force')">
            <img src="@/assets/icons/force.svg" />
          </button>
          <span class="button-hint">Add Force</span>
        </div>
        <div class="button-container">
          <button class="transparent-btn" @click="add('obstacle')">
            <img src="@/assets/icons/obstacle.svg" width="48px" height="48px" />
          </button>
          <span class="button-hint">Add Obstacle</span>
        </div>
        <div class="button-container">
          <button class="transparent-btn" @click="removeSelected">
            <img src="@/assets/icons/delete.svg" />
          </button>
          <span class="button-hint">Delete Selected</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSceneObjects } from '@/composables/useSceneObjects'
import { inject, ref, watch } from 'vue'
import type { Ref } from 'vue'
import type { ObjectCategory, PrimitiveType } from '@/types/editor'

const sceneObjects = inject<Ref<ReturnType<typeof useSceneObjects> | null>>('sceneObjects')
const primitive = ref<PrimitiveType>('cube')

const add = (category: ObjectCategory) => {
  sceneObjects?.value?.addObject(category, primitive.value)
}

function setPrimitive(p: PrimitiveType) {
  primitive.value = p
}

const removeSelected = () => {
  if (sceneObjects?.value?.selectedId.value)
    sceneObjects.value.removeObject(sceneObjects.value.selectedId.value)
}
</script>

<style scoped>
.toolbar {
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  flex-direction: row;
  border-radius: 8px 8px 8px 8px;
}
.toolbar.selector {
  position: relative;
  top: 4px;
  left: 4px;
  flex-direction: row;
  transform: none;
  border-radius: 8px 8px 8px 8px;
}
.connector {
  top: 50%;
  left: 0px;
  text-align: center;
  position: relative;
  gap: 8px;
  background: #333;
  padding: 12px 8px;
  z-index: 10; /* Higher than canvas z-index */
  pointer-events: auto;
}
.subregion {
  top: 0px;
  left: 0px;
  flex-direction: column;
  text-align: center;
  border-radius: 8px 8px 8px 8px;
  position: relative;
  display: flex;
  gap: 8px;
  background: #333;
  padding: 12px 8px;
  z-index: 10; /* Higher than canvas z-index */
  pointer-events: auto;
}
</style>
