<template>
  <div v-if="userIdle" class="hint-images">
    <Transition name="fade" mode="out-in">
      <img :key="currentImage" :src="currentImage" alt="slider image" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, watch, onBeforeUnmount } from 'vue'
import type { Ref } from 'vue'

import leftClick from '@/assets/icons/left-click.png'
import rightClick from '@/assets/icons/right-click.png'
import scroll from '@/assets/icons/scroll.png'
import pinch from '@/assets/icons/pinch.png'
import oneFinger from '@/assets/icons/one-finger.png'
import twoFingers from '@/assets/icons/two-finger.png'

const images = [leftClick, oneFinger, rightClick, twoFingers, scroll, pinch]

const userIdle = inject<Ref<boolean>>('userIdle', ref(false))!
const interval = 2000
const currentIndex = ref(0)
let timer: number | null = null
const currentImage = computed(() => {
  return images[currentIndex.value] || ''
})

function nextImage() {
  if (images.length === 0) return
  currentIndex.value = (currentIndex.value + 1) % images.length
}

function startAutoplay() {
  if (timer) clearInterval(timer)
  timer = setInterval(nextImage, interval)
}

function stopAutoplay() {
  if (!timer) return
  clearInterval(timer)
  timer = null
}

onBeforeUnmount(() => {
  stopAutoplay()
})

watch(userIdle, (idle) => {
  if (idle) startAutoplay()
  else stopAutoplay()
})
</script>

<style scoped>
.hint-images {
  position: absolute;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
}
.hint-images img {
  width: 48px;
  height: 48px;
  filter: invert(100%);
  opacity: 0.75;
  /* object-fit: cover;
  display: block; */
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.8s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
