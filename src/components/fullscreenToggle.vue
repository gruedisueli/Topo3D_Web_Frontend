<template>
  <div class="button-wrapper">
    <IconButton @clicked="$emit('update:fullscreen')" :image-src="FullscreenIcon"></IconButton>
  </div>
</template>

<script setup lang="ts">
import IconButton from './iconButton.vue'
import FullscreenIcon from '@/assets/icons/fullscreen.svg'
</script>

<style scoped>
.button-wrapper {
  position: absolute;
  bottom: 50px;
  left: 50px;
}
</style>
