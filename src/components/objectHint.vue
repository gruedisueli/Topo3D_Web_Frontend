<template>
  <div
    v-if="hover?.hoveredObjectId?.value !== null"
    class="object-hint"
    :style="{ left: mouseClientPos?.x + 'px', top: mouseClientPos!.y + verticalOffset + 'px' }"
  >
    <label class="hint-label"> {{ hoveredType }} </label>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import { useHover } from '@/composables/useHover'
import { useSceneObjects } from '@/composables/useSceneObjects'
import * as THREE from 'three'

const verticalOffset = 20
const hover = inject<ShallowRef<ReturnType<typeof useHover> | null>>('hover')
const sceneObjects = inject<ShallowRef<ReturnType<typeof useSceneObjects> | null>>('sceneObjects')
const mouseClientPos = inject<Ref<THREE.Vector2>>('mouseClientPos')
const hoveredType = computed(() => {
  const obj = sceneObjects?.value?.objects.value.find(
    (o) => o.id === hover?.value?.hoveredObjectId.value,
  )
  let cat: string = obj?.category as string
  if (cat === 'obstacle') cat = 'void'
  return cat
})
</script>

<style scoped>
.object-hint {
  position: absolute;
}
</style>
