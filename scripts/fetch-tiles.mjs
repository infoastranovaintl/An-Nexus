#!/usr/bin/env node
/**
 * Pre-fetch map + DEM tiles for a bounded area into public/tiles/ so the app can
 * run fully OFFLINE. Usage:
 *
 *   node scripts/fetch-tiles.mjs --lat 28.6139 --lng 77.209 --zmin 8 --zmax 15
 *
 * Downloads OSM, Esri satellite, OpenTopoMap and AWS Terrarium DEM tiles into:
 *   public/tiles/<provider>/<z>/<x>/<y>.png
 *
 * Respectful defaults: 2 concurrency, no rate limiting beyond that. For a large
 * area / high zoom this can download a LOT of tiles — start small.
 */

import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outRoot = join(root, 'public', 'tiles')

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) =>
    a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null,
  ).filter(Boolean),
)

const lat = parseFloat(args.lat || '28.6139')
const lng = parseFloat(args.lng || '77.209')
const zMin = parseInt(args.zmin || '8', 10)
const zMax = parseInt(args.zmax || '15', 10)
const radiusKm = parseFloat(args.radius || '10')

const dlat = radiusKm / 111.32
const dlon = radiusKm / (111.32 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01))

const providers = {
  osm: (z, x, y) => `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`,
  satellite: (z, x, y) =>
    `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
  osmtopo: (z, x, y) => `https://a.tile.opentopomap.org/${z}/${x}/${y}.png`,
  'terrain-dem': (z, x, y) =>
    `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
}

function lonToTileX(lon, z) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, z))
}
function latToTileY(lat, z) {
  const r = (lat * Math.PI) / 180
  return Math.floor(
    ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * Math.pow(2, z),
  )
}

async function fetchTile(url, timeoutMs = 20000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    return buf
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

let total = 0
let failed = 0

async function run() {
  for (const [provider, urlFn] of Object.entries(providers)) {
    for (let z = zMin; z <= zMax; z++) {
      const x0 = lonToTileX(lng - dlon, z)
      const x1 = lonToTileX(lng + dlon, z)
      const y0 = latToTileY(lat + dlat, z)
      const y1 = latToTileY(lat - dlat, z)
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const file = join(outRoot, provider, String(z), String(x), `${y}.png`)
          if (existsSync(file)) continue
          const url = urlFn(z, x, y)
          const buf = await fetchTile(url)
          total++
          if (!buf) {
            failed++
            process.stdout.write(`\r${provider} z${z} ${total} fetched, ${failed} failed`)
            continue
          }
          mkdirSync(dirname(file), { recursive: true })
          writeFileSync(file, buf)
          process.stdout.write(`\r${provider} z${z} ${total} fetched, ${failed} failed`)
        }
      }
    }
    console.log('')
  }
  console.log(`\nDone. Total tiles: ${total}, missing/failed: ${failed}`)
  console.log(`Tiles written under ${outRoot}`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
