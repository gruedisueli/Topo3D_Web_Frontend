<template>
  <div class="progress-bar" :class="{ indeterminate }">
    <div class="fill" :style="{ width: indeterminate ? '100%' : clampedProgress + '%' }"></div>
    <div class="label">
      {{ indeterminate ? props.status + '...' : clampedProgress + '%' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value?: number
    indeterminate?: boolean
    status?: string
  }>(),
  {
    value: 0,
    indeterminate: false,
    status: '',
  },
)

const clampedProgress = computed(() => Math.min(100, Math.max(0, props.value)))
</script>

<style scoped>
.progress-bar {
  position: relative;
  width: 100%;
  max-width: 400px;
  height: 30px;
  background-color: #e9ecef;
  border-radius: 15px;
  overflow: hidden;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
}

.progress-bar .fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #007bff, #00bcd4);
  border-radius: 15px;
  transition: width 0.3s ease;
}

.progress-bar.indeterminate .fill {
  background: repeating-linear-gradient(
    90deg,
    #007bff,
    #007bff 200px,
    #00bcd4 200px,
    #00bcd4 400px
  );
  background-size: 200% 100%;
  animation: indeterminate-stripes 1.5s linear infinite;
}

@keyframes indeterminate-stripes {
  0% {
    background-position: 200% 0%;
  }
  100% {
    background-position: 0% 200%;
  }
}

.progress-bar .label {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #333;
  font-weight: bold;
  font-size: 14px;
  pointer-events: none;
}
</style>
