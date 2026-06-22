import { ref } from 'vue'

const ws = ref<WebSocket | null>(null)
const status = ref('disconnected')
const queuePosition = ref<number | null>(null)
const isStarting = ref(false)
const error = ref<string | null>(null)
const latestDensityData = ref<Uint8Array | null>(null)
const iterationCt = ref(0)
const latestStlData = ref<ArrayBuffer | null>(null)
let expectingStl = false

export function useOptimization() {
  function reset() {
    //reset state
    error.value = null
    status.value = 'disconnected'
    queuePosition.value = null
    isStarting.value = false
    latestDensityData.value = null
    latestStlData.value = null
  }

  const connect = (params: Record<string, unknown>) => {
    //prevent multiple connections
    if (
      ws.value &&
      (ws.value.readyState === WebSocket.CONNECTING || ws.value.readyState === WebSocket.OPEN)
    ) {
      console.warn('WebSocket is already connecting or open, ignoring the connect call')
      return
    }

    //close any existing connection if there is one (eg CLOSING or CLOSED but object still exists)
    if (ws.value) {
      ws.value.close()
      ws.value = null
    }

    reset()

    status.value = 'connecting'

    //open the new connection
    ws.value = new WebSocket('wss://openai.vast.ai/gruedi:8000/ws') // new WebSocket('ws://localhost:8000/ws')
    ws.value.binaryType = 'arraybuffer'

    ws.value.onopen = () => {
      status.value = 'connected'
      if (ws.value) ws.value.send(JSON.stringify(params))
    }

    ws.value.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data)
        if (msg.status === 'queued') {
          queuePosition.value = msg.position
          status.value = 'queued'
        } else if (msg.status === 'starting') {
          isStarting.value = true
          iterationCt.value = 0
          expectingStl = false
          status.value = 'running'
        } else if (msg.status === 'complete') {
          status.value = 'complete'
          isStarting.value = false
          iterationCt.value = 0
          if (msg.has_stl) {
            expectingStl = true
          } else {
            ws.value?.close()
          }
        } else if (msg.status === 'error') {
          error.value = msg.message
          status.value = 'error'
          iterationCt.value = 0
          ws.value?.close()
        }
      } else {
        if (expectingStl) {
          const stlArrayBuffer = event.data
          latestStlData.value = stlArrayBuffer
          expectingStl = false
          ws.value?.close()
        } else {
          //binary data received, should be the density field
          const densityArray = new Uint8Array(event.data)
          latestDensityData.value = densityArray
          iterationCt.value += 1
        }
      }
    }

    ws.value.onerror = (err) => {
      error.value = 'WebSocket error'
      status.value = 'error'
      console.error(err)
    }

    ws.value.onclose = () => {
      //keep the complete message if it is complete
      if (status.value !== 'complete') {
        status.value = 'disconnected'
      }
      queuePosition.value = null
      isStarting.value = false
      ws.value = null
    }
  }

  const stop = () => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(JSON.stringify({ command: 'stop' }))
      status.value = 'stopping'
      //backend will complete operation and send final results prior to closing connection
    }
  }

  return {
    reset,
    status,
    queuePosition,
    isStarting,
    error,
    connect,
    stop,
    latestDensityData,
    latestStlData,
    iterationCt,
  }
}
