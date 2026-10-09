import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'
import { createSim } from './sim.mjs'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST = join(__dirname, '..', 'dist')
const PORT = process.env.PORT || 8080

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost')
  let pathname = decodeURIComponent(url.pathname)

  if (pathname === '/') pathname = '/index.html'

  const filePath = join(DIST, pathname)
  const safePath = filePath.startsWith(DIST) ? filePath : null

  if (safePath && existsSync(safePath) && statSync(safePath).isFile()) {
    const ext = extname(safePath).toLowerCase()
    const mime = MIME[ext] || 'application/octet-stream'
    try {
      const data = await readFile(safePath)
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      })
      res.end(data)
    } catch {
      res.writeHead(500)
      res.end('Internal Server Error')
    }
    return
  }

  // SPA fallback — serve index.html for any unmatched path
  try {
    const data = await readFile(join(DIST, 'index.html'))
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
    res.end(data)
  } catch {
    res.writeHead(404)
    res.end('Not Found')
  }
})

const wss = new WebSocketServer({ server })

wss.on('connection', (socket, req) => {
  const ip = req.socket.remoteAddress || '?'
  console.log(`[ws] client connected from ${ip}`)

  const send = (line) => {
    if (socket.readyState === 1) socket.send(line)
  }
  const log = (...args) => console.log('[sim]', ...args)

  const sim = createSim({ send, log })
  sim.start()

  socket.on('message', (data) => {
    const msg = String(data).trim()
    if (msg) sim.handle(msg)
  })

  socket.on('close', () => {
    sim.stop()
    console.log(`[ws] client disconnected from ${ip}`)
  })

  socket.on('error', (err) => {
    sim.stop()
    console.log(`[ws] error from ${ip}:`, err.message)
  })
})

server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║  AN-Nexus Test Server                               ║
║                                                      ║
║  UI:    http://localhost:${PORT}                       ║
║  WS:    ws://localhost:${PORT}                         ║
║                                                      ║
║  Simulated field nodes + live sensor data            ║
║  Open the UI and click "Connect" in Settings         ║
╚══════════════════════════════════════════════════════╝
  `)
})
