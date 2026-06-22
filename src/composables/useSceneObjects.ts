import { ref, shallowRef } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import * as THREE from 'three'
import {
  TransformControls,
  type TransformControlsMode,
} from 'three/addons/controls/TransformControls.js'
import type { EditorObject, ObjectCategory, PrimitiveType } from '@/types/editor'
import { OrbitControls } from 'three/examples/jsm/Addons.js'
import type { SavedScene } from '@/types/scene'

export function useSceneObjects(
  scene: ShallowRef<THREE.Scene | null>,
  camera: ShallowRef<THREE.Camera | null>,
  renderer: ShallowRef<THREE.WebGLRenderer | null>,
  orbitControls: ShallowRef<OrbitControls | null>,
  nelx: Ref<number | null>,
  nely: Ref<number | null>,
  nelz: Ref<number | null>,
) {
  const objects = ref<EditorObject[]>([])
  const selectedId = ref<string | null>(null)
  const selectedObj = ref<EditorObject | null>(null)
  const selectedMesh = shallowRef<THREE.Object3D | null>(null)
  const directionArrow = shallowRef<THREE.ArrowHelper | null>(null)
  const forceSelectablePrefab = new THREE.Group()
  const stem = new THREE.CylinderGeometry(0.2, 0.2, 10)
  stem.translate(0, 5, 0)
  const head = new THREE.ConeGeometry(0.5, 1)
  head.translate(0, 10, 0)
  const arrMat = new THREE.MeshStandardMaterial({ color: 0xff0000 })
  forceSelectablePrefab.add(new THREE.Mesh(stem, arrMat))
  forceSelectablePrefab.add(new THREE.Mesh(head, arrMat))
  forceSelectablePrefab.visible = false
  scene.value?.add(forceSelectablePrefab)
  let activeControls: TransformControls | null = null
  const isDragging = ref<boolean>(false)
  const nx = nelx
  const ny = nely
  const nz = nelz
  const forceColor = 0xff0000
  const wireframeColor = 0xffffff
  //let prevInvRot = new THREE.Quaternion()

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
        color = forceColor
        break
      case 'obstacle':
        color = 0x0088ff
        break
    }
    const material = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.6 })
    const mesh = new THREE.Mesh(geometry, material.clone())
    mesh.userData = {
      id: obj.id,
      category: obj.category,
      primitive: obj.primitive,
      //additional properties to track emissivity for hover behavior
      originalEmissiveHex: material.emissive.getHex(),
      originalEmissiveIntensity: material.emissiveIntensity,
      originalColor: material.emissive.clone(),
    }
    mesh.applyMatrix4(obj.transform)
    return mesh
  }

  function changeSelectedPrimitive(primitive: PrimitiveType) {
    if (!selectedId.value || !selectedMesh.value || !selectedObj.value) return
    selectedObj.value.primitive = primitive
    const pos = selectedMesh.value.position.clone()
    const id = selectedId.value
    selectObject(null)
    removeMesh(id)
    addMesh(selectedObj.value, pos)
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
      obj.forceVector = new THREE.Vector3(0, 1, 0)
    }
    objects.value.push(obj)
    addMesh(obj, pos)
    return id
  }

  function addMesh(obj: EditorObject, position?: THREE.Vector3) {
    const id = obj.id
    const mesh = createMesh(obj)
    scene?.value?.add(mesh)
    if (obj.category === 'force') {
      const arrow = new THREE.ArrowHelper(obj.forceVector?.clone(), position, 1, 0xff0000)
      arrow.userData = { parentId: id, type: 'direction' }
      scene?.value?.add(arrow)
      directionArrow.value = arrow
    }
    selectObject(id)
  }

  function addObjectWithTransform(
    category: ObjectCategory,
    primitive: PrimitiveType,
    transform: THREE.Matrix4,
    autoSelect: boolean,
    forceVector?: THREE.Vector3,
  ) {
    const id = crypto.randomUUID() as string
    const obj: EditorObject = {
      id,
      category,
      primitive,
      transform: transform,
    }
    const fV = forceVector ?? new THREE.Vector3(1, 0, 0)
    if (category === 'force') {
      obj.forceVector = fV
    }
    objects.value.push(obj)
    const mesh = createMesh(obj)
    scene?.value?.add(mesh)
    if (category === 'force') {
      const arrow = new THREE.ArrowHelper(fV, mesh.position, fV.length(), 0xff0000)
      arrow.userData = { parentId: id, type: 'direction' }
      scene?.value?.add(arrow)
      directionArrow.value = arrow
    }
    if (autoSelect) selectObject(id)
    return id
  }

  function removeObject(id: string) {
    removeMesh(id)
    objects.value = objects.value.filter((o) => o.id !== id)
    if (selectedId.value === id) selectObject(null)
  }

  function removeMesh(id: string) {
    const obj = objects.value.find((o) => o.id === id)
    if (!obj) return
    const mesh = scene?.value?.children.find((c) => c.userData?.id === id) as THREE.Mesh
    if (mesh) {
      mesh.geometry.dispose()
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose())
      } else {
        mesh.material?.dispose()
      }
      scene?.value?.remove(mesh)
    }
    if (obj.category === 'force') {
      const arrow = scene?.value?.children.find(
        (c) => c.userData?.parentId === id && c.userData?.type === 'direction',
      )
      if (arrow) scene?.value?.remove(arrow)
    }
  }

  function selectObject(id: string | null) {
    if (isDragging.value) return
    if (selectedId.value === id) return
    removeControls()
    selectedId.value = id
    if (!id) {
      showHideForceControls(false)
      selectedMesh.value = null
      directionArrow.value = null
      selectedObj.value = null
      return
    }
    const mesh = scene?.value?.children.find((c) => c.userData?.id === id) as THREE.Mesh
    if (!mesh) return
    selectedMesh.value = mesh
    if (mesh.userData.category === 'force') {
      const arrow = scene?.value?.children.find(
        (c) => c.userData?.parentId === id && c.userData?.type === 'direction',
      )
      if (arrow) {
        directionArrow.value = arrow as THREE.ArrowHelper
      }
    }
    selectedObj.value = objects.value.find((o) => o.id === id) as EditorObject
  }

  function removeControls() {
    if (activeControls === null) return
    scene?.value?.remove(activeControls.getHelper())
    activeControls.dispose()
    activeControls = null
  }

  function pickObject(mouseX: number, mouseY: number) {
    console.log('picking')
    if (!renderer?.value || !camera?.value) return
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    mouse.x = mouseX // (mouseX / renderer.value.domElement.clientWidth) * 2 - 1
    mouse.y = mouseY //-(mouseY / renderer.value.domElement.clientHeight) * 2 + 1
    raycaster.setFromCamera(mouse, camera.value)
    const selectableObjs: THREE.Object3D[] = []
    objects.value.forEach((o) => {
      const mesh = scene?.value?.children.find((c) => c.userData?.id === o.id) as THREE.Mesh
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

  function showHideForceControls(show: boolean) {
    if (
      !selectedMesh.value ||
      !directionArrow.value ||
      !selectedObj.value ||
      selectedObj.value.category !== 'force'
    )
      return
    forceSelectablePrefab.visible = show
    if (show) forceSelectablePrefab.applyMatrix4(directionArrow.value.matrix)
    else {
      forceSelectablePrefab.visible = false
      forceSelectablePrefab.matrix.identity()
      forceSelectablePrefab.matrix.decompose(
        forceSelectablePrefab.position,
        forceSelectablePrefab.quaternion,
        forceSelectablePrefab.scale,
      )
    }
    const mesh = selectedMesh.value as THREE.Mesh
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach((m) => {
        const mSm = m as THREE.MeshStandardMaterial
        if (!mSm) return
        mSm.wireframe = show
        mSm.color = new THREE.Color(!show ? forceColor : wireframeColor)
      })
    } else {
      const mSm = mesh.material as THREE.MeshStandardMaterial
      if (mSm) {
        mSm.wireframe = show
        mSm.color = new THREE.Color(!show ? forceColor : wireframeColor)
      }
    }
  }

  function showTransformControls(mode: string | null) {
    if (!camera?.value || !renderer?.value) return
    removeControls()
    if (mode === null) return
    if (!selectedMesh.value || !selectedId.value) return
    const isForce = mode.includes('force')
    if (isForce && !directionArrow.value) return
    let tMode: string
    if (mode === 'translate') tMode = mode
    else if (mode.includes('rotate')) tMode = 'rotate'
    else tMode = 'scale'

    activeControls = new TransformControls(camera.value, renderer.value.domElement)
    activeControls.setMode(tMode as TransformControlsMode)
    activeControls.translationSnap = 0.5
    activeControls.scaleSnap = 0.5
    activeControls.rotationSnap = Math.PI / 16
    activeControls.minX = 0.5 //minX is not found by IDE but it exists and works
    activeControls.minY = 0.5
    activeControls.minZ = 0.5
    activeControls.maxX = (nx.value ?? Infinity) - 0.5
    activeControls.maxY = (ny.value ?? Infinity) - 0.5
    activeControls.maxZ = (nz.value ?? Infinity) - 0.5
    activeControls.attach(isForce ? directionArrow.value! : selectedMesh.value)
    activeControls.addEventListener('dragging-changed', (event) => {
      // if (event.value && activeControls) {
      //   prevInvRot = activeControls.object.quaternion.clone().invert()
      // }
      if (orbitControls.value) orbitControls.value.enabled = !event.value
      isDragging.value = event.value as boolean
      if (!event.value) {
        // //adjust the direction arrow the amount of the parent's rotation
        // if (!isForce && tMode === 'rotate' && directionArrow.value && selectedMesh.value) {
        //   const deltaRot = selectedMesh.value.quaternion.clone().multiply(prevInvRot)
        //   directionArrow.value.quaternion.premultiply(deltaRot)
        // }
        syncFromScene()
      }
    })
    activeControls.addEventListener('change', () => {
      if (mode !== 'translate' && mode !== 'force_rotate') return
      if (!directionArrow.value || !selectedMesh.value) return
      if (mode === 'force_rotate') {
        forceSelectablePrefab.rotation.copy(directionArrow.value.rotation)
      } else {
        directionArrow.value!.position.copy(selectedMesh.value.position)
        forceSelectablePrefab.position.copy(selectedMesh.value.position)
      }
    })
    scene?.value?.add(activeControls.getHelper())
  }

  //update object transform from mesh (call after transform controls update)
  function syncFromScene() {
    if (!selectedId.value || !selectedMesh.value) return
    const obj = objects.value.find((o) => o.id === selectedId.value)
    if (!obj) return
    obj.transform.copy(selectedMesh.value.matrix)
    if (obj.category === 'force' && directionArrow.value && obj.forceVector) {
      const worldDir = new THREE.Vector3(0, 1, 0).applyQuaternion(directionArrow.value.quaternion)
      const length = obj.forceVector.length()
      const forceVec = worldDir.multiplyScalar(length)
      obj.forceVector = forceVec
    }
  }

  //update the strength of force objects
  function updateForceStrength(strength: number) {
    if (!selectedId.value || !selectedMesh.value || !directionArrow.value) return
    const obj = objects.value.find((o) => o.id === selectedId.value)
    if (!obj || !obj.forceVector) return
    const forceVec = new THREE.Vector3(obj.forceVector.x, obj.forceVector.y, obj.forceVector.z)
    forceVec.normalize()
    forceVec.multiplyScalar(strength)
    console.log('change strength,oldvec', obj.forceVector)
    console.log('change strength,newvec', forceVec)
    obj.forceVector = forceVec
    directionArrow.value.setLength(strength)
  }

  function loadSceneFromData(sceneData: SavedScene) {
    clearAllObjects()
    for (const saved of sceneData.objects) {
      const matrix = new THREE.Matrix4().fromArray(saved.transform)
      const forceVector = saved.forceVector
        ? new THREE.Vector3(saved.forceVector[0], saved.forceVector[1], saved.forceVector[2])
        : undefined
      addObjectWithTransform(saved.category, saved.primitive, matrix, false, forceVector)
    }
  }

  function clearAllObjects() {
    // iterate over a copy because removal modifies the array
    const ids = objects.value.map((o) => o.id)
    for (const id of ids) {
      removeObject(id)
    }
  }

  function setForceDir(dir: string) {
    if (!selectedObj.value?.forceVector || !directionArrow.value) return
    let targetVec: THREE.Vector3
    switch (dir) {
      case 'posX':
        targetVec = new THREE.Vector3(1, 0, 0)
        break
      case 'negX':
        targetVec = new THREE.Vector3(-1, 0, 0)
        break
      case 'posY':
        targetVec = new THREE.Vector3(0, 1, 0)
        break
      case 'negY':
        targetVec = new THREE.Vector3(0, -1, 0)
        break
      case 'posZ':
        targetVec = new THREE.Vector3(0, 0, 1)
        break
      case 'negZ':
        targetVec = new THREE.Vector3(0, 0, -1)
        break
      default:
        console.error('unknown force direction')
        return
    }
    const sourceVec = selectedObj.value.forceVector.clone()
    sourceVec.normalize()
    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(sourceVec, targetVec)
    directionArrow.value.applyQuaternion(quaternion)
    forceSelectablePrefab.applyQuaternion(quaternion)
    syncFromScene()
  }

  return {
    objects,
    selectedId,
    selectedMesh,
    selectedObj,
    addObject,
    removeObject,
    selectObject,
    syncFromScene,
    pickObject,
    showTransformControls,
    updateForceStrength,
    clearAllObjects,
    loadSceneFromData,
    changeSelectedPrimitive,
    showHideForceControls,
    setForceDir,
    removeControls,
  }
}
