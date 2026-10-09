export interface WizardIdentity {
  mac: string
  name?: string
  model?: string
  chip?: string
}

export interface SerialManagerCallbacks {
  onStatus: (text: string) => void
  onIdentity: (ident: WizardIdentity) => void
  onWiFiConnecting: () => void
  onWiFiConnected: (info: { ip: string; name?: string; mdns?: string; token?: string }) => void
  onWiFiFailed: () => void
  onLogLine: (line: string) => void
}

const IDEN_MAX_RETRIES = 6
const IDEN_RETRY_MS = 1200

export class SerialManager {
  private port: SerialPort | null = null
  private reader: ReadableStreamDefaultReader<string> | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null
  private lineBuf = ''
  private idenRetryTimer: number | null = null
  private idenRetryCount = 0
  private identity: WizardIdentity | null = null
  private cb: SerialManagerCallbacks

  constructor(cb: SerialManagerCallbacks) {
    this.cb = cb
  }

  get hasIdentity(): boolean {
    return this.identity != null
  }

  async connect(): Promise<void> {
    if (!('serial' in navigator)) {
      this.cb.onStatus("This browser doesn't support Web Serial. Use Chrome, Edge, or Opera on desktop.")
      return
    }
    try {
      this.port = await navigator.serial.requestPort()
      await this.port.open({ baudRate: 460800 })
      this.identity = null
      this.startReadLoop()
      this.startIdenRetry()
      this.cb.onStatus('Connected. Identifying device…')
    } catch (e) {
      this.port = null
      this.cb.onStatus('Connection cancelled or failed: ' + (e as Error).message)
    }
  }

  private startIdenRetry() {
    this.idenRetryCount = 0
    if (this.idenRetryTimer) clearTimeout(this.idenRetryTimer)
    this.sendIdenAttempt()
  }

  private sendIdenAttempt() {
    if (this.identity) return
    this.idenRetryCount++
    void this.write('WHORU\n')
    if (this.idenRetryCount >= IDEN_MAX_RETRIES) {
      this.cb.onStatus(
        "No response from the board after several tries.<br><br>Check: <b>Tools → USB CDC On Boot</b> is Enabled in the Arduino IDE for this board, and that you picked the correct COM port (some boards expose two). Try the Arduino Serial Monitor at 460800 baud first — you should see boot text and an <code>IDEN:</code> line automatically; if that's silent too, it's a firmware/board-setting issue, not this dashboard.",
      )
      return
    }
    this.idenRetryTimer = window.setTimeout(() => this.sendIdenAttempt(), IDEN_RETRY_MS)
  }

  private async startReadLoop() {
    if (!this.port?.readable) return
    const decoder = new TextDecoderStream()
    this.port.readable.pipeTo(decoder.writable as unknown as WritableStream<Uint8Array>)
    this.reader = decoder.readable.getReader()
    this.writer = this.port.writable?.getWriter() || null
    this.lineBuf = ''
    for (;;) {
      let result: ReadableStreamReadResult<string>
      try {
        result = await this.reader.read()
      } catch {
        break
      }
      if (result.done) break
      this.lineBuf += result.value
      let idx: number
      while ((idx = this.lineBuf.indexOf('\n')) >= 0) {
        const line = this.lineBuf.slice(0, idx).replace(/\r$/, '')
        this.lineBuf = this.lineBuf.slice(idx + 1)
        if (line.length) this.handleLine(line)
      }
    }
  }

  private handleLine(line: string) {
    if (line.startsWith('IDEN:')) {
      try {
        if (this.idenRetryTimer) clearTimeout(this.idenRetryTimer)
        this.identity = JSON.parse(line.slice(5)) as WizardIdentity
        this.cb.onIdentity(this.identity)
      } catch {
        /* ignore malformed */
      }
      return
    }
    if (line.startsWith('WIFI:CONNECTING')) {
      this.cb.onWiFiConnecting()
      return
    }
    if (line.startsWith('WIFI:CONNECTED:')) {
      try {
        const info = JSON.parse(line.slice('WIFI:CONNECTED:'.length)) as {
          ip: string
          name?: string
          mdns?: string
          token?: string
        }
        this.cb.onWiFiConnected(info)
      } catch {
        /* ignore */
      }
      return
    }
    if (line.startsWith('WIFI:FAILED:')) {
      this.cb.onWiFiFailed()
      return
    }
    if (line.startsWith('LOG:')) {
      this.cb.onLogLine(line.slice(4))
    }
  }

  async write(str: string): Promise<void> {
    if (!this.writer) return
    try {
      await this.writer.write(new TextEncoder().encode(str))
    } catch {
      /* disconnected */
    }
  }

  sendWifi(ssid: string, pass: string, name: string): Promise<void> {
    return this.write('SETWIFI:' + JSON.stringify({ ssid, pass, name }) + '\n')
  }

  async close(): Promise<void> {
    if (this.idenRetryTimer) clearTimeout(this.idenRetryTimer)
    try {
      await this.reader?.cancel()
    } catch {
      /* ignore */
    }
    try {
      this.writer?.releaseLock()
    } catch {
      /* ignore */
    }
    try {
      await this.port?.close()
    } catch {
      /* ignore */
    }
    this.port = null
    this.reader = null
    this.writer = null
  }
}

export function isSerialSupported(): boolean {
  return 'serial' in navigator
}
