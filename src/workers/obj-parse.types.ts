/* Shared message types for the off-thread OBJ loader.

   Kept in a file with NO three/three-stdlib imports — importing types here must
   stay cheap for the main-thread typecheck, while the actual worker runs as
   plain JS (vite bundles it, tsc ignores it). */

export interface WorkerRequest {
  objUrl: string
  mtlUrl: string
  basePath: string
  index: number
  name: string
}

/* one mesh, as plain data — typed arrays are transferred (zero-copy), not
   structured-cloned. color: null means "no MTL material" → caller tints. */
export interface SerializedMesh {
  name: string
  position: Float32Array
  normal: Float32Array
  uv?: Float32Array
  index?: Uint32Array
  color: [number, number, number] | null
  roughness: number
  metalness: number
  matrix: Float32Array
}

export interface WorkerResponse {
  ok: boolean
  reason?: 'fetch' | 'parse'
  label?: string
  index?: number
  children?: SerializedMesh[]
  bounds?: { maxY: number; minX: number; maxX: number; minZ: number; maxZ: number }
  rotX?: number
  rotY?: number
  meshes?: number
  triangles?: number
}