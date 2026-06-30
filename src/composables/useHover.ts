import * as THREE from 'three'
import { ref } from 'vue'
import type { ShallowRef, Ref } from 'vue'
import type { EditorObject } from '@/types/editor'

export function useHover(
  scene: ShallowRef<THREE.Scene | null>,
  sceneObjects: Ref<EditorObject[] | null>,
  camera: ShallowRef<THREE.Camera | null>,
  renderer: ShallowRef<THREE.WebGLRenderer | null>,
  pointer: Ref<THREE.Vector2 | null>,
) {
  //hover constants
  const hoveredObjects: THREE.Mesh[] = [] //objects either currently or previously hovered
  const hoveredObjectId = ref<string | null>(null)
  const glowColor = new THREE.Color(0xffdd44)
  const glowIntensity = 1.5
  const lerpSpeed = 0.08
  const EPSILON = 0.0005

  //raycaster constants
  const raycaster = new THREE.Raycaster()

  function onMouseLeave() {
    hoveredObjectId.value = null
  }

  function onMouseMove() {
    if (!pointer.value || !camera.value || !scene.value) return

    //update raycaster
    raycaster.setFromCamera(pointer.value, camera.value)

    //check intersections
    const objects = scene.value.children.filter((c) => c.userData?.id)
    const intersects = raycaster.intersectObjects(objects)
    hoveredObjectId.value = null
    if (intersects.length > 0) {
      const hovered = intersects[0]?.object
      if (hovered && hovered instanceof THREE.Mesh) {
        hoveredObjectId.value = hovered?.userData.id
        if (hoveredObjectId.value && !hoveredObjects.includes(hovered))
          hoveredObjects.push(hovered as THREE.Mesh)
      }
    }
  }

  //returns true if material has reached target state
  function updateMaterial(
    mat: THREE.MeshStandardMaterial,
    targetColor: THREE.Color,
    targetIntensity: number,
  ): boolean {
    const intensityDiff = Math.abs(mat.emissiveIntensity - targetIntensity)
    const colorDiff = new THREE.Vector3(targetColor.r, targetColor.g, targetColor.b).distanceTo(
      new THREE.Vector3(mat.emissive.r, mat.emissive.g, mat.emissive.b),
    )
    mat.emissive.lerp(targetColor, lerpSpeed)
    mat.emissiveIntensity += (targetIntensity - mat.emissiveIntensity) * lerpSpeed

    if (intensityDiff < EPSILON && colorDiff < EPSILON) {
      // Snap to exact values
      mat.emissiveIntensity = targetIntensity
      mat.emissive.copy(targetColor)
      return true
    }
    return false
  }

  function update() {
    if (
      !renderer?.value ||
      !camera?.value ||
      !sceneObjects?.value ||
      !scene?.value ||
      !pointer?.value ||
      hoveredObjects.length === 0
    )
      return

    //lerp animations
    for (let i = hoveredObjects.length - 1; i >= 0; i--) {
      const obj = hoveredObjects[i]
      if (!obj) continue
      const mat = obj.material
      const isHovered = obj.userData.id === hoveredObjectId.value

      const targetColor = isHovered ? glowColor : obj.userData.originalColor
      const targetIntensity = isHovered ? glowIntensity : obj.userData.originalEmissiveIntensity

      let done = false
      if (Array.isArray(mat)) {
        mat.forEach((m) => {
          if (!(m instanceof THREE.MeshStandardMaterial)) return
          const mSm = m as THREE.MeshStandardMaterial
          const d = updateMaterial(mSm, targetColor, targetIntensity)
          if (d) done = true
        })
      } else {
        if (!(mat instanceof THREE.MeshStandardMaterial)) continue
        const mSm = mat as THREE.MeshStandardMaterial
        done = updateMaterial(mSm, targetColor, targetIntensity)
      }
      if (done && !isHovered) {
        hoveredObjects.pop()
      }
    }
  }

  return {
    updateHover: update,
    mouseLeaveHover: onMouseLeave,
    mouseMoveHover: onMouseMove,
    hoveredObjectId,
  }
}
