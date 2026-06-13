<!-- <template>
  <div v-if="selectedObj" class="properties">
    <h3>{{ selectedObj.category }} ({{ selectedObj.primitive }})</h3>
    <div v-if="selectedObj.category === 'force'">
      <label>Magnitude:</label>
      <input type="number" v-model.number="selectedObj.magnitude" step="0.1" />
    </div>
    <div v-if="selectedObj.category === 'force'">
      <label>Direction (rotate child arrow):</label>
      <button @click="editDirection">Edit Direction</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
import { useSceneObjects } from '@/composables/useSceneObjects'

const props = defineProps({
  sceneObjects: Object as PropType<ReturnType<typeof useSceneObjects> | null>,
})
const selectedObj = computed(() => {
  if (!props || !props.sceneObjects) return null
  const id = props.sceneObjects.selectedId.value
  return props.sceneObjects.objects.value.find((o) => o.id === id)
})
const editDirection = () => {
  alert('implement direction rotation')
}
</script>

<style scoped>
.properties {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.7);
  padding: 10px;
  border-radius: 8px;
  color: white;
  z-index: 20;
}
</style> -->
