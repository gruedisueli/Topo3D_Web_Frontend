import { shallowRef, watch } from 'vue'
import type { ShallowRef, Ref } from 'vue'
import * as THREE from 'three'
import type { ForcePoint } from '@/workers/voxelWorker'

import gridVertexShader from '@/shaders/grid/vertex.glsl?raw'
import gridFragmentShader from '@/shaders/grid/fragment.glsl?raw'

export function useVoxelVisualization(
  nelx: Ref<number>,
  nely: Ref<number>,
  nelz: Ref<number>,
  threshold: Ref<number>,
  supportMask: Ref<Uint8Array | null>,
  obstacleMask: Ref<Uint8Array | null>,
  meshMask: Ref<Uint8Array | null>,
  forcePoints: Ref<ForcePoint[] | null>,
  latestDensityData: Ref<Uint8Array | null>,
  scene: ShallowRef<THREE.Scene | null>,
) {
  const iterationsMesh = shallowRef<THREE.InstancedMesh | null>(null)
  const voxelFieldMesh = shallowRef<THREE.Mesh | null>(null)
  const supportsMesh = shallowRef<THREE.InstancedMesh | null>(null)
  const obstaclesMesh = shallowRef<THREE.InstancedMesh | null>(null)
  const meshMesh = shallowRef<THREE.InstancedMesh | null>(null)
  const forceArrows: THREE.ArrowHelper[] = []

  //pre-build a unit cube geometry
  const boxGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5)
  const iterationBoxGeometry = new THREE.BoxGeometry(0.75, 0.75, 0.75)
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
  })

  //grid materials
  const uniforms = {
    uGridColor: { value: new THREE.Color('#00ffff') },
    uLineWidth: { value: 0.5 },
  }

  const gridMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: gridVertexShader,
    fragmentShader: gridFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.FrontSide,
  })

  function updateVoxels(densityData: Uint8Array) {
    if (!nelx?.value || !nely?.value || !nelz?.value || !threshold?.value) return
    if (densityData.length !== nelx.value * nely.value * nelz.value) {
      console.error('Density array length does not match expected size')
      return
    }
    const positions: THREE.Vector3[] = []
    const colors: THREE.Color[] = []
    const scales: THREE.Vector3[] = []

    let idx = 0
    //returning values from pytopo3d are in y,x,z order
    for (let y = 0; y < nely.value; y++) {
      for (let x = 0; x < nelx.value; x++) {
        for (let z = 0; z < nelz.value; z++) {
          const byteVal = densityData[idx++]
          const density = byteVal! / 255
          if (density < threshold.value) continue
          positions.push(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5))
          colors.push(new THREE.Color(1, 1 - density, 1 - density))
          scales.push(new THREE.Vector3(density, density, density))
        }
      }
    }

    instantiateVoxels(
      iterationsMesh,
      iterationBoxGeometry,
      material.clone(),
      positions,
      scales,
      colors,
    )
  }

  //clear all preview voxels from scene
  function clear() {
    removeMesh(iterationsMesh)
    removeMesh(supportsMesh)
    removeMesh(obstaclesMesh)
    removeMesh(meshMesh)
    clearArrows()
  }

  function removeMesh(mesh: ShallowRef<THREE.InstancedMesh | null>) {
    if (!mesh.value) return
    mesh.value.dispose()
    if (Array.isArray(mesh.value.material)) {
      mesh.value.material.forEach((m) => m.dispose())
    } else {
      mesh.value.material?.dispose()
    }
    scene?.value?.remove(mesh.value)
    mesh.value = null
  }

  function instantiateVoxels(
    mesh: ShallowRef<THREE.InstancedMesh | null>,
    prefab: THREE.BoxGeometry,
    material: THREE.MeshStandardMaterial,
    positions: THREE.Vector3[],
    scales?: THREE.Vector3[],
    colors?: THREE.Color[],
  ) {
    if (mesh.value) {
      mesh.value.dispose()
      scene?.value?.remove(mesh.value)
      mesh.value = null
    }
    mesh.value = new THREE.InstancedMesh(prefab, material, positions.length)
    const colorArray = colors ? new Float32Array(colors.length * 3) : null

    positions.forEach((pos, i) => {
      const m = new THREE.Matrix4()
      if (scales) m.compose(pos, new THREE.Quaternion(), scales[i]!)
      else m.setPosition(pos.x, pos.y, pos.z)
      if (colorArray) {
        const c = colors![i]!
        colorArray[i * 3] = c.r
        colorArray[i * 3 + 1] = c.g
        colorArray[i * 3 + 2] = c.b
      }
      mesh.value?.setMatrixAt(i, m)
    })

    if (colorArray) mesh.value.instanceColor = new THREE.InstancedBufferAttribute(colorArray, 3)

    mesh.value.instanceMatrix.needsUpdate = true
    scene?.value?.add(mesh.value)
  }

  function updateObjectVoxels(voxelMask: Uint8Array, type: string) {
    if (!nelx?.value || !nely?.value || !nelz?.value) return
    const positions: THREE.Vector3[] = []

    let idx = 0
    for (let x = 0; x < nelx.value; x++) {
      for (let y = 0; y < nely.value; y++) {
        for (let z = 0; z < nelz.value; z++) {
          const byteVal = voxelMask[idx++]
          if (byteVal === 0) continue
          positions.push(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5))
        }
      }
    }

    switch (type) {
      case 'support':
        instantiateVoxels(supportsMesh, boxGeometry, material.clone(), positions)
        break
      case 'obstacle':
        instantiateVoxels(obstaclesMesh, boxGeometry, material.clone(), positions)
        break
      case 'mesh':
        instantiateVoxels(meshMesh, boxGeometry, material.clone(), positions)
        break
      default:
        console.error('unrecognized object type to visualize with voxels')
        return
    }
  }

  function updateForceArrows() {
    clearArrows()
    if (!forcePoints?.value) return
    for (const force of forcePoints.value) {
      const fV = new THREE.Vector3(force.vector[0], force.vector[1], force.vector[2])
      const length = fV.length()
      fV.normalize()
      const pos = indexToXyz(force.index)
      pos.add(new THREE.Vector3(0.5, 0.5, 0.5))
      const arrow = new THREE.ArrowHelper(fV, pos, length, 0xff0000)
      scene?.value?.add(arrow)
      forceArrows.push(arrow)
    }
  }

  function clearArrows() {
    for (const arrow of forceArrows) {
      scene?.value?.remove(arrow)
    }
  }

  function indexToXyz(index: number): THREE.Vector3 {
    if (!nely?.value || !nelz?.value) return new THREE.Vector3()
    const z = index % nelz.value
    const y = Math.floor(index / nelz.value) % nely.value
    const x = Math.floor(index / (nely.value * nelz.value))
    return new THREE.Vector3(x, y, z)
  }

  function showHideVoxelField(show: boolean) {
    if (!voxelFieldMesh.value) return
    voxelFieldMesh.value.visible = show
  }

  function showHideVoxels(show: boolean) {
    if (supportsMesh.value) supportsMesh.value.visible = show
    if (obstaclesMesh.value) obstaclesMesh.value.visible = show
    for (const arrow of forceArrows) {
      arrow.visible = show
    }
    if (meshMesh.value) meshMesh.value.visible = show
  }

  function updateVoxelField() {
    if (!scene?.value) return
    if (voxelFieldMesh.value) {
      voxelFieldMesh.value.geometry.dispose()
      if (Array.isArray(voxelFieldMesh.value.material)) {
        voxelFieldMesh.value.material.forEach((m) => m.dispose())
      } else {
        voxelFieldMesh.value.material?.dispose()
      }
      scene?.value.remove(voxelFieldMesh.value)
      voxelFieldMesh.value = null
    }

    //const { nelx, nely, nelz } = props
    if (!nelx?.value || !nely?.value || !nelz?.value) return
    const geom = new THREE.BoxGeometry(nelx.value, nely.value, nelz.value)
    geom.translate(nelx.value / 2, nely.value / 2, nelz.value / 2)
    voxelFieldMesh.value = new THREE.Mesh(geom, gridMaterial.clone())
    //voxelFieldMesh.value.layers.set(1) //custom layer for masking by renderer
    scene.value.add(voxelFieldMesh.value)

    // const positions: THREE.Vector3[] = []

    // for (let x = 0; x < nelx; x++) {
    //   for (let y = 0; y < nely; y++) {
    //     for (let z = 0; z < nelz; z++) {
    //       positions.push(new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5))
    //     }
    //   }
    // }

    // instantiateVoxels(voxelFieldMesh, miniBoxGeometry, material.clone(), positions)
  }

  watch(latestDensityData, (newData) => {
    if (newData) updateVoxels(newData)
  })

  watch(supportMask, (newData) => {
    if (newData) updateObjectVoxels(newData, 'support')
  })

  watch(obstacleMask, (newData) => {
    if (newData) updateObjectVoxels(newData, 'obstacle')
  })

  watch(meshMask, (newData) => {
    if (newData) updateObjectVoxels(newData, 'mesh')
  })

  watch(forcePoints, () => {
    updateForceArrows()
  })

  watch([nelx, nely, nelz], () => {
    updateVoxelField()
  })

  watch(
    threshold,
    () => {
      if (latestDensityData.value) updateVoxels(latestDensityData.value)
    },
    //{ immediate: true } //not sure if this is important, tbd
  )

  updateVoxelField()
  return { clear, showHideVoxelField, showHideVoxels }
}
