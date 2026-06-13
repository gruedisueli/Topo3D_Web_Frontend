import { ref, shallowRef } from 'vue'
import * as THREE from 'three'
import {
  TransformControls,
  type TransformControlsMode,
} from 'three/addons/controls/TransformControls.js'
import type { EditorObject, ObjectCategory, PrimitiveType } from '@/types/editor'
import { OrbitControls } from 'three/examples/jsm/Addons.js'

export function useSceneObjects(
  scene: THREE.Scene,
  camera: THREE.Camera,
  renderer: THREE.WebGLRenderer,
  orbitControls: OrbitControls,
) {
  const objects = ref<EditorObject[]>([])
  const selectedId = ref<string | null>(null)
  const selectedMesh = shallowRef<THREE.Object3D | null>(null)
  const directionArrow = shallowRef<THREE.ArrowHelper | null>(null)
  let activeControls: TransformControls | null = null
  const isDragging = ref<boolean>(false)

  //Helper to create a mesh from EditorObject
  function createMesh(obj: EditorObject): THREE.Mesh {
    let geometry: THREE.BufferGeometry
    switch (obj.primitive) {
      case 'cube':
        geometry = new THREE.BoxGeometry(1, 1, 1)
        break
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.5, 32, 32)
        break
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
        break
    }
    let color: number
    switch (obj.category) {
      case 'support':
        color = 0x00ff00
        break
      case 'force':
        color = 0xff0000
        break
      case 'obstacle':
        color = 0x0088ff
        break
    }
    const material = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.6 })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData = { id: obj.id, category: obj.category, primitive: obj.primitive }
    return mesh
  }

  function addObject(category: ObjectCategory, primitive: PrimitiveType, position?: THREE.Vector3) {
    const id = crypto.randomUUID() as string
    const pos = position || new THREE.Vector3(0, 0, 0)
    const obj: EditorObject = {
      id,
      category,
      primitive,
      transform: new THREE.Matrix4(),
    }
    if (category === 'force') {
      obj.forceVector = new THREE.Vector3(0, 0, 1)
    }
    objects.value.push(obj)
    const mesh = createMesh(obj)
    scene.add(mesh)
    if (category === 'force') {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), pos, 1, 0xff0000)
      arrow.userData = { parentId: id, type: 'direction' }
      scene.add(arrow)
      directionArrow.value = arrow
    }
    selectObject(id)
    return id
  }

  function removeObject(id: string) {
    const obj = objects.value.find((o) => o.id === id)
    if (!obj) return
    const mesh = scene.children.find((c) => c.userData?.id === id)
    if (mesh) scene.remove(mesh)
    if (obj.category === 'force') {
      const arrow = scene.children.find(
        (c) => c.userData?.parentId === id && c.userData?.type === 'direction',
      )
      if (arrow) scene.remove(arrow)
    }
    objects.value = objects.value.filter((o) => o.id !== id)
    if (selectedId.value === id) selectObject(null)
  }

  function selectObject(id: string | null) {
    if (isDragging.value) return
    if (selectedId.value === id) return
    removeControls()
    selectedId.value = id
    if (!id) {
      selectedMesh.value = null
      directionArrow.value = null
      return
    }
    const mesh = scene.children.find((c) => c.userData?.id === id) as THREE.Mesh
    if (!mesh) return
    selectedMesh.value = mesh
    if (mesh.userData.category === 'force') {
      const arrow = scene.children.find(
        (c) => c.userData?.parentId === id && c.userData?.type === 'direction',
      )
      if (arrow) {
        directionArrow.value = arrow as THREE.ArrowHelper
      }
    }
  }

  function removeControls() {
    if (activeControls === null) return
    scene.remove(activeControls.getHelper())
    activeControls.dispose()
    activeControls = null
  }

  function pickObject(mouseX: number, mouseY: number) {
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    mouse.x = (mouseX / renderer.domElement.clientWidth) * 2 - 1
    mouse.y = -(mouseY / renderer.domElement.clientHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera)
    const selectableObjs: THREE.Object3D[] = []
    objects.value.forEach((o) => {
      const mesh = scene.children.find((c) => c.userData?.id === o.id) as THREE.Mesh
      if (!mesh) return
      selectableObjs.push(mesh)
    })
    const intersects = raycaster.intersectObjects(selectableObjs)
    if (intersects.length === 0) selectObject(null)
    else {
      const selectedMesh = intersects[0]!.object
      const id = selectedMesh.userData.id
      selectObject(id)
    }
  }

  function showTransformControls(mode: string | null) {
    removeControls()
    if (mode === null) return
    if (!selectedMesh.value || !selectedId.value) return
    const isForce = mode.includes('force')
    if (isForce && !directionArrow.value) return
    let tMode: string
    if (mode === 'translate') tMode = mode
    else if (mode.includes('rotate')) tMode = 'rotate'
    else tMode = 'scale'

    activeControls = new TransformControls(camera, renderer.domElement)
    activeControls.setMode(tMode as TransformControlsMode)
    activeControls.attach(isForce ? directionArrow.value! : selectedMesh.value)
    activeControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value
      isDragging.value = event.value as boolean
      if (!event.value) {
        syncFromScene()
      }
    })
    activeControls.addEventListener('change', () => {
      if (mode != 'translate') return
      if (!directionArrow.value || !selectedMesh.value) return
      directionArrow.value!.position.copy(selectedMesh.value.position)
    })
    scene.add(activeControls.getHelper())
  }

  //update object transform from mesh (call after transform controls update)
  function syncFromScene() {
    if (!selectedId.value || !selectedMesh.value) return
    const obj = objects.value.find((o) => o.id === selectedId.value)
    if (!obj) return
    obj.transform.copy(selectedMesh.value.matrix)
  }

  //update the strength of force objects
  function updateForceStrength(strength: number) {
    if (!selectedId.value || !selectedMesh.value || !directionArrow.value) return
    const obj = objects.value.find((o) => o.id === selectedId.value)
    if (!obj || !obj.forceVector) return
    const forceVec = new THREE.Vector3(obj.forceVector.x, obj.forceVector.y, obj.forceVector.z)
    forceVec.normalize()
    forceVec.multiplyScalar(strength)
    obj.forceVector = forceVec
    directionArrow.value.setLength(strength)
  }

  return {
    objects,
    selectedId,
    selectedMesh,
    addObject,
    removeObject,
    selectObject,
    syncFromScene,
    pickObject,
    showTransformControls,
    updateForceStrength,
  }
}
