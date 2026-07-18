<template>
  <div
    class="backdrop"
    v-if="
      websocket?.status.value === 'disconnected' ||
      websocket?.status.value === 'connecting' ||
      websocket?.status.value === 'busy'
    "
  ></div>
  <div
    class="popup-window"
    v-if="
      websocket?.status.value === 'disconnected' ||
      websocket?.status.value === 'connecting' ||
      websocket?.status.value === 'busy'
    "
  >
    <h2>Welcome! Please connect...</h2>
    <button
      class="simple-button"
      @click="websocket?.connect"
      :disabled="websocket?.status.value !== 'disconnected'"
    >
      Connect
    </button>
    <ProgressBar
      v-if="websocket?.status.value === 'connecting'"
      :indeterminate="true"
      status="connecting..."
    />
    <p class="body-text" v-if="websocket?.status.value === 'busy'">
      Servers are busy, try again later...
    </p>
  </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import ProgressBar from './progressBar.vue'
import { useWebsocket } from '@/composables/useWebsocket.ts'

const websocket = inject<ReturnType<typeof useWebsocket> | null>('websocket')
</script>

<style scoped>
.popup-window {
  top: 100px;
  width: min(50%, 300px);
}

.backdrop {
  position: absolute;
  width: 100%;
  height: 100%;
  opacity: 50%;
  background: #ffffff;
  z-index: 10;
  pointer-events: auto;
}
</style>
