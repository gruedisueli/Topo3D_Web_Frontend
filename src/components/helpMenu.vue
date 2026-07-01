<template>
  <div v-if="props.open" class="popup-window">
    <h2>{{ helpPages[currentIndex]?.heading }}</h2>
    <p v-html="renderMarkdownLinks(helpPages[currentIndex]?.body ?? '')"></p>
    <div class="media-container">
      <template v-for="(src, index) in helpPages[currentIndex]?.media" :key="index">
        <img v-if="isImage(src)" :src="renderMediaSrc(src)" alt="Help media" />
        <video
          v-else-if="isVideo(src)"
          :src="renderMediaSrc(src)"
          controls
          muted
          autoplay
          loop
        ></video>
      </template>
    </div>
    <p v-html="helpPages[currentIndex]?.credits ?? ''"></p>
    <span class="next-prev">
      <button
        class="simple-button half-width"
        @click="currentIndex--"
        :disabled="currentIndex <= 0"
      >
        Previous
      </button>
      <button
        class="simple-button half-width"
        @click="currentIndex++"
        :disabled="currentIndex >= helpPages.length - 1"
      >
        Next
      </button>
    </span>
    <button class="simple-button" @click="$emit('update:open', false)">Close</button>
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

function isImage(src: string): boolean {
  const ext = src?.split('?')[0]?.toLowerCase() ?? ''
  return (
    ext.endsWith('.jpg') ||
    ext.endsWith('.jpeg') ||
    ext.endsWith('.png') ||
    ext.endsWith('.gif') ||
    ext.endsWith('.webp')
  )
}

function isVideo(src: string): boolean {
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
.media-container {
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.media-container img,
.media-container video {
  max-width: 100%;
  height: 300px;
  object-fit: contain;
  border-radius: 8px;
}

.next-prev {
  text-align: center;
}

.simple-button.half-width {
  width: 50%;
}
</style>
