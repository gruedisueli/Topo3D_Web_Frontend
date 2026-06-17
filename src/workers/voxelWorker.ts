/// <reference lib="webworker" />

import * as THREE from 'three'
import { MeshBVH } from 'three-mesh-bvh'

export interface VoxelizeMessage {
  type: string
  gridSize: [number, number, number]
  worldMin: [number, number, number]
  worldMax: [number, number, number]
  objects: Array<{
    matrixWorld: number[]
    type: 'cube' | 'sphere' | 'cylinder'
    category: 'obstacle' | 'support' | 'force'
    forceVector?: [number, number, number] // required if category is 'force'
  }>
}

export interface MeshVoxelizeMessage {
  type: string
  gridSize: [number, number, number]
  mesh: {
    vertices: Float32Array
    indices: Uint32Array
    matrixWorld: number[]
  }
}

export interface ForcePoint {
  index: number
  vector: [number, number, number]
}

//primitive tests in local space (unit primitives)
function insideCube(lx: number, ly: number, lz: number): boolean {
  return Math.abs(lx) <= 0.5 && Math.abs(ly) <= 0.5 && Math.abs(lz) <= 0.5
}

function insideSphere(lx: number, ly: number, lz: number): boolean {
  return lx * lx + ly * ly + lz * lz <= 0.25
}

function insideCylinder(lx: number, ly: number, lz: number): boolean {
  const r2 = lx * lx + lz * lz
  return r2 <= 0.25 && Math.abs(ly) <= 0.5
}

//helper to get the test function for a primitve type
function getTestFunc(type: string): (x: number, y: number, z: number) => boolean {
  switch (type) {
    case 'cube':
      return insideCube
    case 'sphere':
      return insideSphere
    case 'cylinder':
      return insideCylinder
    default:
      return () => false
  }
}

self.onmessage = (e: MessageEvent) => {
  const { type, ...data } = e.data
  switch (type) {
    case 'primitives':
      handlePrimitives(data)
      break
    case 'mesh':
      handleMesh(data)
      break
    default:
      console.warn('Unkown message type: ', type)
  }
}

//worker message handler
function handlePrimitives(data: VoxelizeMessage) {
  //console.log('voxel worker starting to voxelize primitives')
  const { gridSize, worldMin, worldMax, objects } = data
  const [nx, ny, nz] = gridSize
  const totalVoxels = nx * ny * nz

  //precompute the inverse matrix for each object
  const prepared = objects.map((obj) => {
    //create DOMMatrix from 16-number array (column major)
    const mat = new DOMMatrix(obj.matrixWorld)
    const inv = mat.inverse()
    const testFunc = getTestFunc(obj.type)
    return { inv, testFunc, category: obj.category, forceVec: obj.forceVector }
  })

  //output arrays (0 = empty, 1 = occupied)
  const obstacleMask = new Uint8Array(totalVoxels)
  const supportMask = new Uint8Array(totalVoxels)
  const forcePoints: ForcePoint[] = []

  //voxel step sizes (voxel centers)
  const stepX = (worldMax[0] - worldMin[0]) / nx
  const stepY = (worldMax[1] - worldMin[1]) / ny
  const stepZ = (worldMax[2] - worldMin[2]) / nz

  //iterate through voxels
  let idx = 0
  for (let i = 0; i < nx; i++) {
    const wx = worldMin[0] + i * stepX + 0.5
    for (let j = 0; j < ny; j++) {
      const wy = worldMin[1] + j * stepY + 0.5
      for (let k = 0; k < nz; k++) {
        const wz = worldMin[2] + k * stepZ + 0.5
        const worldPoint = { x: wx, y: wy, z: wz }

        let isObstacle = false
        let isSupport = false

        for (const p of prepared) {
          const local = p.inv.transformPoint(worldPoint)
          const lx = local.x,
            ly = local.y,
            lz = local.z

          if (p.testFunc(lx, ly, lz)) {
            if (p.category === 'obstacle') isObstacle = true
            if (p.category === 'support') isSupport = true
            if (p.category === 'force') {
              forcePoints.push({
                index: idx,
                vector: [p.forceVec![0], p.forceVec![1], p.forceVec![2]],
              })
            }
          }
        }

        obstacleMask[idx] = isObstacle ? 1 : 0
        supportMask[idx] = isSupport ? 1 : 0
        idx++
      }
    }
  }
  //console.log('voxel worker finished voxelizing primitives')
  self.postMessage({ obstacleMask, supportMask, forcePoints })
}

function handleMesh(data: MeshVoxelizeMessage) {
  //console.log('worker starting to voxelize mesh')
  const { gridSize, mesh } = data
  const [nx, ny, nz] = gridSize
  const totalVoxels = nx * ny * nz
  const { vertices, indices, matrixWorld } = mesh
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  const material = new THREE.MeshStandardMaterial({ color: 0x3f7dbd, side: THREE.DoubleSide })
  const idxArr: number[] = [...indices]
  geometry.setIndex(idxArr)
  const bvh = new MeshBVH(geometry)
  const mat = new DOMMatrix(matrixWorld)
  const inv = mat.inverse()
  const meshMask = new Uint8Array(totalVoxels)
  let idx = 0
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) {
      //fast voxelization method
      //starting from the xy plane, we shoot a grid of rays through the mesh
      //each ray is assumed to start outside the mesh,
      //as the mesh is supposed to be placed inside the voxel grid with a buffer around it
      //this means each ray should have an even number of intersections with a closed mesh
      let worldPt = { x: x + 0.5, y: y + 0.5, z: 0.5 }
      let localPt = inv.transformPoint(worldPt)
      const worldRayVec = new THREE.Vector3(0, 0, 1)
      const localRayVec = transformVector(worldRayVec, inv)
      let localRay = new THREE.Raycaster(
        new THREE.Vector3(localPt.x, localPt.y, localPt.z),
        localRayVec,
      )
      let intersections = bvh.raycast(localRay.ray, material)
      if (intersections.length % 2 === 1) {
        //possibly a tolerance issue with a vertex, etc
        //try a set of random rays pointing in the same axial direction, from different origins
        console.log('Initial voxelization of xy coord failed, trying using fallback method')
        const tryCt = 10
        let found = false
        for (let i = 0; i < tryCt; i++) {
          worldPt = new DOMPoint(x + 0.5 + randomNumber(0.1), y + 0.5 + randomNumber(0.1), 0.5)
          localPt = inv.transformPoint(worldPt)
          localRay = new THREE.Raycaster(
            new THREE.Vector3(localPt.x, localPt.y, localPt.z),
            localRayVec,
          )
          intersections = bvh.raycast(localRay.ray, material)
          if (intersections.length % 2 === 1) continue
          found = true
          break
        }
        if (!found) {
          console.error('Error identifing region of voxel grid')
          meshMask.fill(0, idx, idx + nz)
          idx += nz
          continue
        }
      }

      const insideRegions: [number, number][] = []
      for (let i = 0; i < intersections.length; i += 2) {
        const j = i + 1
        const region: [number, number] = [intersections[i]!.distance, intersections[j]!.distance]
        insideRegions.push(region)
      }

      for (let z = 0; z < nz; z++) {
        let inside = false
        for (const reg of insideRegions) {
          if (z + 0.5 < reg[0] || z + 0.5 > reg[1]) continue
          inside = true
          break
        }
        meshMask[idx++] = inside ? 1 : 0
      }
    }
  }

  geometry.dispose()
  material.dispose()

  //console.log('worker finished voxelizing mesh')
  self.postMessage({ meshMask })
}

function transformVector(vector: THREE.Vector3, matrix: DOMMatrix) {
  const point = new DOMPoint(vector.x, vector.y, vector.z)
  const transformedPoint = matrix.transformPoint(point)
  return new THREE.Vector3(transformedPoint.x, transformedPoint.y, transformedPoint.z)
}

//random +/- number within range
function randomNumber(range: number) {
  const random = Math.random() - 0.5 //change range to (-0.5, +0.5)
  return random * range
}

// function handleMesh_slow(data: MeshVoxelizeMessage) {
//   const { gridSize, mesh } = data
//   const [nx, ny, nz] = gridSize
//   const totalVoxels = nx * ny * nz
//   const { vertices, indices, matrixWorld } = mesh
//   const geometry = new THREE.BufferGeometry()
//   geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
//   const material = new THREE.MeshStandardMaterial({ color: 0x3f7dbd, side: THREE.DoubleSide })
//   const idxArr: number[] = [...indices]
//   geometry.setIndex(idxArr)
//   const bvh = new MeshBVH(geometry)
//   console.log('voxel worker orig mat', matrixWorld)
//   const mat = new DOMMatrix(matrixWorld)
//   const inv = mat.inverse()
//   console.log('voxel worker DOMmatrix', mat)
//   console.log('voxel worker inv mat', inv)
//   const meshMask = new Uint8Array(totalVoxels)
//   let idx = 0
//   for (let x = 0; x < nx; x++) {
//     for (let y = 0; y < ny; y++) {
//       for (let z = 0; z < nz; z++) {
//         const worldPt = { x: x, y: y, z: z }
//         const localPt = inv.transformPoint(worldPt)
//         const localRay = new THREE.Raycaster(
//           new THREE.Vector3(localPt.x, localPt.y, localPt.z),
//           new THREE.Vector3(0, 1, 0),
//         )
//         const intersections = bvh.raycast(localRay.ray, material)
//         const inside = intersections.length % 2 === 1
//         meshMask[idx++] = inside ? 1 : 0
//       }
//     }
//   }

//   geometry.dispose()
//   material.dispose()

//   self.postMessage({ meshMask })
// }
