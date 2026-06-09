<template>
  <div class="toolbar">
    <div class="section">
      <h4>Add Support</h4>
      <button @click="add('support', 'cube')">Cube</button>
      <button @click="add('support', 'sphere')">Sphere</button>
      <button @click="add('support', 'cylinder')">Cylinder</button>
    </div>
    <div class="section">
      <h4>Add Force</h4>
      <button @click="add('force', 'cube')">Cube</button>
      <button @click="add('force', 'sphere')">Sphere</button>
      <button @click="add('force', 'cylinder')">Cylinder</button>
    </div>
    <div class="section">
      <h4>Add Obstacle</h4>
      <button @click="add('obstacle', 'cube')">Cube</button>
      <button @click="add('obstacle', 'sphere')">Sphere</button>
      <button @click="add('obstacle', 'cylinder')">Cylinder</button>
    </div>
    <button v-if="selectedId" @click="removeSelected" class="delete">Delete Selected</button>
  </div>
</template>

<script setup lang="ts">
import { useSceneObjects } from '@/composables/useSceneObjects'
import type { ObjectCategory, PrimitiveType } from '@/types/editor'

const props = defineProps<{ sceneObjects: ReturnType<typeof useSceneObjects> }>()
const { addObject, removeObject, selectedId } = props.sceneObjects

const add = (category: ObjectCategory, primitive: PrimitiveType) => {
  addObject(category, primitive)
}

const removeSelected = () => {
  if (selectedId.value) removeObject(selectedId.value)
}
</script>

<style scoped>
.toolbar {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 8px;
  z-index: 20;
  display: flex;
  gap: 20px;
}
.section {
  border-left: 1px solid #888;
  padding-left: 10px;
}
button {
  margin: 2px;
}
.delete {
  background: red;
}
</style>
