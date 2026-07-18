<template>
  <div v-if="props.open" class="popup-window">
    <h2>{{ helpPages[currentIndex]?.heading }}</h2>
    <p v-html="renderMarkdownLinks(helpPages[currentIndex]?.body ?? '')"></p>
    <div class="media-container">
      <img
        v-if="isImage(helpPages[currentIndex]?.media)"
        :src="renderMediaSrc(helpPages[currentIndex]!.media)"
        alt="Help media"
      />
      <video
        v-else-if="isVideo(helpPages[currentIndex]?.media)"
        :src="renderMediaSrc(helpPages[currentIndex]!.media)"
        controls
        muted
        autoplay
        loop
      ></video>
    </div>
    <p class="credit" v-html="helpPages[currentIndex]?.credits ?? ''"></p>
    <div class="bottom-buttons">
      <span class="next-prev">
        <button
          class="simple-button third-width"
          @click="currentIndex = 0"
          :disabled="currentIndex <= 0"
        >
          Beginning
        </button>
        <button
          class="simple-button third-width"
          @click="currentIndex--"
          :disabled="currentIndex <= 0"
        >
          Previous
        </button>
        <button
          class="simple-button third-width"
          @click="currentIndex++"
          :disabled="currentIndex >= helpPages.length - 1"
        >
          Next
        </button>
      </span>
      <button class="simple-button" @click="$emit('update:open', false)">Close</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { helpPages } from '@/data/helpContent'
const props = defineProps<{
  open: boolean
}>()

defineEmits<{
  'update:open': [value: boolean]
}>()

const currentIndex = ref(0)

function renderMarkdownLinks(text: string): string {
  return text.replace(
    /\[(.+?)\]\((.+?)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  )
}

function isImage(src: string | undefined): boolean {
  if (!src) return false
  const ext = src?.split('?')[0]?.toLowerCase() ?? ''
  return (
    ext.endsWith('.jpg') ||
    ext.endsWith('.jpeg') ||
    ext.endsWith('.png') ||
    ext.endsWith('.gif') ||
    ext.endsWith('.webp')
  )
}

function isVideo(src: string | undefined): boolean {
  if (!src) return false
  const ext = src?.split('?')[0]?.toLowerCase() ?? ''
  return ext.endsWith('.mp4') || ext.endsWith('.webm') || ext.endsWith('.mov')
}

function renderMediaSrc(src: string): string {
  // // Files in public/ are served at root level, so './media/...' -> '/media/...'
  // if (src.startsWith('./media/')) {
  //   return src.replace('./', '/')
  // }
  return src
}
</script>

<style scoped>
.popup-window {
  top: 100px;
  bottom: 100px;
  width: min(50%, 800px);
}

.credit {
  text-align: center;
}

.media-container {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  max-width: 100%;
  max-height: min(50vh, 1000px);
  min-height: 0;
  flex-shrink: 0;
  gap: 8px;
  overflow: auto;
}

.media-container img,
.media-container video {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 8px;
}

.bottom-buttons {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.next-prev {
  display: flex;
  gap: 8px;
  text-align: center;
}

.simple-button.third-width {
  width: 33%;
}
</style>
