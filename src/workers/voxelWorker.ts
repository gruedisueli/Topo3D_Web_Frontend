/// <reference lib="webworker" />

export interface VoxelizeMessage {
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

interface ForcePoint {
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

//worker message handler
self.onmessage = (e: MessageEvent<VoxelizeMessage>) => {
  const { gridSize, worldMin, worldMax, objects } = e.data
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
    const wx = worldMin[0] + (i + 0.5) * stepX
    for (let j = 0; j < ny; j++) {
      const wy = worldMin[1] + (j + 0.5) * stepY
      for (let k = 0; k < nz; k++) {
        const wz = worldMin[2] + (k + 0.5) * stepZ
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
  self.postMessage({ obstacleMask, supportMask, forcePoints })
}
