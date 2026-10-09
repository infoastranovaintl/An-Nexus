/**
 * HTTP transport — sends queued sync payloads to the configured server.
 */

export interface SyncPayload {
  deviceId: string
  timestamp: string
  data: Record<string, unknown>
}

export interface SyncResult {
  ok: boolean
  status: number
  message: string
}

const MAX_RETRIES = 5
const BASE_DELAY_MS = 2000

export async function sendSync(
  serverUrl: string,
  payload: SyncPayload,
  retryCount: number,
): Promise<SyncResult> {
  if (!serverUrl) {
    return { ok: false, status: 0, message: 'No sync server URL configured' }
  }

  const url = serverUrl.replace(/\/+$/, '') + '/api/sync'

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (res.ok) {
      return { ok: true, status: res.status, message: 'Synced' }
    }

    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      return { ok: false, status: res.status, message: `Server error: ${res.status}` }
    }

    if (retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, retryCount)
      await new Promise((r) => setTimeout(r, delay))
      return sendSync(serverUrl, payload, retryCount + 1)
    }

    return { ok: false, status: res.status, message: `Failed after ${MAX_RETRIES} retries: ${res.status}` }
  } catch (e) {
    if (retryCount < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, retryCount)
      await new Promise((r) => setTimeout(r, delay))
      return sendSync(serverUrl, payload, retryCount + 1)
    }
    return { ok: false, status: 0, message: `Network error: ${(e as Error).message}` }
  }
}

export function getDeviceId(): string {
  const key = 'an-nexus-device-id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}
