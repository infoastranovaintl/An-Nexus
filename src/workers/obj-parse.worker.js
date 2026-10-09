/* Off-main-thread OBJ + MTL loader.
   Parsing a ~2.4MB wavefront OBJ + fitting it (Box3 walks, rotation/scaling)
   can block the main thread for hundreds of ms on load. This worker does all of
   that away from the UI, then hands back plain, transferable geometry buffers.

   Main thread only wraps the arrays into cheap BufferGeometry and commits the
   scene via a React transition — so the dashboard stays interactive on load.

   Runs as plain JS: tsc ignores it, vite bundles it like any module worker.
   Message shapes are documented in obj-parse.types.ts.
*/
import { MTLLoader, OBJLoader } from 'three-stdlib'
import * as THREE from 'three'

const scope = self

/** @param {string} url */
async function fetchText(url) {
  return fetch(url)
    .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .catch(() => null)
}

/** Fold the root transform into the local box corners for world-space bounds.
 *  @returns {{min: THREE.Vector3, max: THREE.Vector3} | null} */
function cornersBounds(box, root) {
  if (box.isEmpty()) return null
  const cs = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ].map((c) => c.applyMatrix4(root.matrix))
  const min = cs[0].clone()
  const max = cs[0].clone()
  for (const c of cs) {
    min.min(c)
    max.max(c)
  }
  return { min, max }
}

scope.onmessage = async (e) => {
  const { objUrl, mtlUrl, basePath, index, name } = e.data

  /* 1. materials — optional; without an MTL the model gets a neutral tint */
  let matCreator = null
  const mtlText = await fetchText(mtlUrl)
  if (mtlText) {
    try {
      matCreator = new MTLLoader().parse(mtlText, basePath)
      matCreator.preload()
    } catch {
      matCreator = null
    }
  }

  /* 2. geometry */
  const objText = await fetchText(objUrl)
  if (!objText) {
    scope.postMessage({ ok: false, reason: 'fetch', label: name, index })
    return
  }

  /** @type {THREE.Object3D} */
  let root
  try {
    const loader = new OBJLoader()
    if (matCreator) loader.setMaterials(matCreator)
    root = loader.parse(objText)
  } catch {
    scope.postMessage({ ok: false, reason: 'parse', label: name, index, meshes: 0, triangles: 0 })
    return
  }

  /* 3. fit — mirrored from the main-thread fit() so orientation/size never matter */
  root.position.set(0, 0, 0)
  root.rotation.set(0, 0, 0)
  root.scale.setScalar(1)
  root.updateMatrixWorld(true)
  let box = new THREE.Box3().setFromObject(root)
  if (box.isEmpty()) {
    scope.postMessage({ ok: false, reason: 'parse', label: name, index, meshes: 0, triangles: 0 })
    return
  }
  let size = box.getSize(new THREE.Vector3())

  /* Z-up → Y-up: only when the model is genuinely flat in Y but deep in Z. */
  if (size.y < Math.min(size.x, size.z) * 0.3 && size.z >= size.x * 0.8) {
    root.rotation.x = -Math.PI / 2
    root.updateMatrixWorld(true)
    box = new THREE.Box3().setFromObject(root)
    size = box.getSize(new THREE.Vector3())
  }

  /* longest ground axis horizontal → crest spans left ↔ right */
  if (size.z > size.x) {
    root.rotation.y = (root.rotation.y || 0) - Math.PI / 2
    root.updateMatrixWorld(true)
    box = new THREE.Box3().setFromObject(root)
    size = box.getSize(new THREE.Vector3())
  }

  const sc = 16 / Math.max(size.x, size.z, 1e-6)
  root.scale.setScalar(sc)

  const c = box.getCenter(new THREE.Vector3())
  root.position.set(-c.x * sc, -box.min.y * sc + 0.2, -c.z * sc)
  root.updateMatrixWorld(true)

  /* 4. serialize + bounds */
  const children = []
  let meshes = 0
  let triangles = 0
  root.traverse((n) => {
    const mesh = n
    if (!mesh.isMesh || !mesh.geometry) return
    const geo = mesh.geometry
    const pos = geo.getAttribute('position')
    const norm = geo.getAttribute('normal')
    if (!pos || !norm) return
    meshes += 1
    triangles += pos.count
    const mat = matCreator ? (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) : null
    const hasColor = !!mat && !!mat.color
    children.push({
      name: mesh.name,
      position: new Float32Array(pos.array),
      normal: new Float32Array(norm.array),
      uv: geo.getAttribute('uv') ? new Float32Array(geo.getAttribute('uv').array) : undefined,
      index: geo.index ? new Uint32Array(geo.index.array) : undefined,
      color: hasColor ? [mat.color.r, mat.color.g, mat.color.b] : null,
      roughness: mat && typeof mat.roughness === 'number' ? mat.roughness : 0.7,
      metalness: mat && typeof mat.metalness === 'number' ? mat.metalness : 0.1,
      matrix: new Float32Array(mesh.matrixWorld.elements),
    })
  })

  const bounds = cornersBounds(box, root)
  if (!bounds) {
    scope.postMessage({ ok: false, reason: 'parse', label: name, index, meshes: 0, triangles: 0 })
    return
  }
  const transfer = children.flatMap((sm) => [sm.position.buffer, sm.normal.buffer, sm.index?.buffer, sm.uv?.buffer, sm.matrix.buffer]).filter(Boolean)
  scope.postMessage(
    {
      ok: true,
      label: name,
      index,
      children,
      bounds: { maxY: bounds.max.y, minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z },
      rotX: root.rotation.x,
      rotY: root.rotation.y,
      meshes,
      triangles,
    },
    transfer,
  )
}