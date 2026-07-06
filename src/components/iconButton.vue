<template>
  <div class="btn-container">
    <button class="transparent-btn" @click="$emit('clicked')" :class="{ activated: activated }">
      <img class="btn-img" :src="imageSrc" />
    </button>
    <label class="btn-label">{{ text }}</label>
  </div>
</template>

<script setup lang="ts">
interface Props {
  activated?: boolean
  imageSrc: string
  text?: string
}

withDefaults(defineProps<Props>(), {
  activated: false,
  imageSrc: 'src',
  text: '',
})

defineEmits<{
  (e: 'clicked'): void
}>()
</script>

<style scoped>
.btn-img {
  width: 48px;
  height: 48px;
}
</style>
