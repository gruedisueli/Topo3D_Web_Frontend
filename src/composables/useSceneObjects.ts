import { ref, shallowRef, reactive } from 'vue'
import * as THREE from 'three'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
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
  let selectedMesh: THREE.Object3D | null = null
  let transformControls: TransformControls | null = null
  const directionArrow: THREE.ArrowHelper | null = null

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
    mesh.position.copy(obj.position)
    mesh.rotation.copy(obj.rotation)
    mesh.scale.copy(obj.scale)
    return mesh
  }

  function addObject(category: ObjectCategory, primitive: PrimitiveType, position?: THREE.Vector3) {
    const id = crypto.randomUUID()
    const pos = position || new THREE.Vector3(0, 0, 0)
    const obj: EditorObject = {
      id,
      category,
      primitive,
      position: pos,
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
    }
    if (category === 'force') {
      obj.magnitude = 1.0
      obj.directionRotation = new THREE.Euler(0, 0, 0)
    }
    objects.value.push(obj)
    const mesh = createMesh(obj)
    scene.add(mesh)
    if (category === 'force') {
      const arrow = new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), pos, 1, 0xff0000)
      arrow.userData = { parentId: id, type: 'direction' }
      scene.add(arrow)
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
    if (transformControls) {
      transformControls.dispose()
      transformControls = null
    }
    selectedId.value = id
    if (!id) {
      selectedMesh = null
      return
    }
    const mesh = scene.children.find((c) => c.userData?.id === id) as THREE.Mesh
    if (!mesh) return
    selectedMesh = mesh
    transformControls = new TransformControls(camera, renderer.domElement)
    transformControls.setRotationSnap(90)
    transformControls.setMode('scale')
    transformControls.attach(mesh)
    transformControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value
    })
    scene.add(transformControls.getHelper())
  }

  //update object transform from mesh (call after transform controls update)
  function syncFromScene() {
    if (!selectedId.value || !selectedMesh) return
    const obj = objects.value.find((o) => o.id === selectedId.value)
    if (!obj) return
    obj.position.copy(selectedMesh.position)
    obj.rotation.copy(selectedMesh.rotation)
    obj.scale.copy(selectedMesh.scale)
  }

  return { objects, selectedId, addObject, removeObject, selectObject, syncFromScene }
}
