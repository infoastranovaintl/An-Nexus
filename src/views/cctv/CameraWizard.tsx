import { useEffect, useRef, useState } from 'react'
import { LuWifiOff as WifiOff } from 'react-icons/lu'
import { useCctvStore, MAX_CAMERAS, type Camera } from '../../store/cctv'
import { isSerialSupported, SerialManager, type WizardIdentity } from '../../lib/cctv/serial'
import { Dialog } from '../../components/ui/Dialog'
import { Modal } from '../../components/ui/Modal'
import { RichText } from '../../components/ui/primitives'
import { cn } from '../../lib/utils'

interface Props {
  onClose: () => void
}

export function CameraWizard({ onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [status, setStatus] = useState('')
  const [name, setName] = useState('')
  const [ssid, setSsid] = useState('')
  const [pass, setPass] = useState('')
  const [result, setResult] = useState<{ mode: 'connecting' | 'done' | 'failed'; text: string }>({
    mode: 'connecting',
    text: 'Sending credentials to the camera…',
  })
  const [ssidError, setSsidError] = useState(false)
  const attemptsRef = useRef(0)
  const identityRef = useRef<WizardIdentity | null>(null)
  const [manager, setManager] = useState<SerialManager | null>(null)

  useEffect(() => {
    const mgr = new SerialManager({
      onStatus: setStatus,
      onIdentity: (ident) => {
        identityRef.current = ident
        setName(ident.name || '')
        setStep(2)
      },
      onWiFiConnecting: () => setResult({ mode: 'connecting', text: 'Camera is joining the Wi-Fi network…' }),
      onWiFiConnected: (info) => {
        const store = useCctvStore.getState()
        setResult({ mode: 'done', text: `Connected — camera is live at <b>${info.ip}</b>` })
        const newCam: Camera = {
          id: identityRef.current?.mac?.replace(/:/g, '') || 'cam' + Date.now(),
          name: info.name || 'AN-CCTV Node',
          ip: info.ip,
          mdns: info.mdns,
          token: info.token || '',
        }
        store.addCamera(newCam)
        store.cctvLog(`Camera <b>${newCam.name}</b> provisioned at ${newCam.ip}`, 'ok')
        if (store.cameras.length + 1 > MAX_CAMERAS) {
          store.cctvLog(
            `${store.cameras.length + 1} cameras paired — the dashboard is tuned for up to ${MAX_CAMERAS} at a time; more will still work but expect it to feel heavier.`,
            'err',
          )
        }
      },
      onWiFiFailed: () =>
        setResult({ mode: 'failed', text: 'Wi-Fi connection failed — check the SSID and password and try again.' }),
      onLogLine: () => {},
    })
    setManager(mgr)
    return () => {
      void mgr.close()
    }
  }, [])

  useEffect(() => {
    if (step === 1 && attemptsRef.current === 0) {
      attemptsRef.current = 1
      void manager?.connect()
    }
  }, [manager, step])

  const connectFailed = /(cancelled or failed|No response|doesn't support)/i.test(status)

  if (!isSerialSupported()) {
    return (
      <Modal open onClose={onClose} title="Add Camera · USB">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-tx3/10 bg-s2 px-4 py-6 text-center">
          <WifiOff size={24} className="text-tx3" />
          <p className="text-[0.68rem] leading-relaxed text-tx2">
            Web Serial isn't supported in this browser.
            <br />
            Use Chrome or Edge on desktop.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <>
      <Modal open onClose={onClose} title="Add Camera · USB">
        {/* step segments */}
        <div className="mb-5 flex items-center gap-1.5">
          {['Connect', 'Wi-Fi', 'Result'].map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center gap-1">
              <span
                className={cn(
                  'h-1 w-full',
                  i < step - 1 ? 'bg-ac' : i === step - 1 ? 'bg-ac' : 'bg-s3',
                )}
              />
              <span
                className={cn('text-[0.58rem] tracking-[0.06em] uppercase', i <= step - 1 ? 'text-ac' : 'text-tx3')}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <p className="text-[0.66rem] leading-relaxed text-tx2">
              Connect the camera over USB and pick its serial port. The dashboard will identify the board automatically.
            </p>
            <div
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3.5 py-3',
                connectFailed ? 'border-rd/25 bg-rd/5' : 'border-tx3/10 bg-s2',
              )}
            >
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  connectFailed ? 'bg-rd' : status ? 'animate-dot-pulse bg-am' : 'bg-tx3/50',
                )}
              />
              <span className={cn('truncate text-[0.72rem] font-semibold', connectFailed ? 'text-rd' : 'text-tx')}>
                {status ? <RichText text={status} /> : 'Waiting for serial port…'}
              </span>
            </div>
            <button
              onClick={() => void manager?.connect()}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-ac/40 bg-ac/10 px-4 py-2 text-[0.68rem] font-semibold text-ac transition-colors hover:bg-ac/15"
            >
              {status && !connectFailed ? 'Try again' : 'Connect'}
            </button>
          </div>
        )}

        {step === 2 && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!ssid.trim()) {
                setSsidError(true)
                return
              }
              setStep(3)
              setResult({ mode: 'connecting', text: 'Sending credentials to the camera…' })
              void manager?.sendWifi(ssid.trim(), pass, name.trim() || 'AN-CCTV Node')
            }}
          >
            <label htmlFor="cam-name" className="flex flex-col gap-1">
              <span className="text-[0.6rem] tracking-[0.06em] text-tx3 uppercase">Camera name</span>
              <input
                id="cam-name"
                type="text"
                autoComplete="off"
                spellCheck={false}
                className="w-full cursor-text rounded-lg border border-tx3/15 bg-s2 px-3 py-2.5 text-[0.72rem] text-tx outline-none placeholder:text-tx3 focus:border-ac/40"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="AN-CCTV Node"
              />
            </label>
            <label htmlFor="cam-ssid" className="flex flex-col gap-1">
              <span className="text-[0.6rem] tracking-[0.06em] text-tx3 uppercase">Wi-Fi SSID</span>
              <input
                id="cam-ssid"
                type="text"
                autoComplete="off"
                autoFocus
                spellCheck={false}
                className="w-full cursor-text rounded-lg border border-tx3/15 bg-s2 px-3 py-2.5 text-[0.72rem] text-tx outline-none placeholder:text-tx3 focus:border-ac/40"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="Network name (e.g. home-wifi)"
              />
            </label>
            <label htmlFor="cam-pass" className="flex flex-col gap-1">
              <span className="text-[0.6rem] tracking-[0.06em] text-tx3 uppercase">Wi-Fi password</span>
              <input
                id="cam-pass"
                type="password"
                autoComplete="new-password"
                spellCheck={false}
                className="w-full cursor-text rounded-lg border border-tx3/15 bg-s2 px-3 py-2.5 text-[0.72rem] text-tx outline-none placeholder:text-tx3 focus:border-ac/40"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="••••••••"
              />
            </label>
            <button
              type="submit"
              className="mt-1 cursor-pointer rounded-lg border border-ac/40 bg-ac/10 px-4 py-2 text-[0.68rem] font-semibold text-ac transition-colors hover:bg-ac/15"
            >
              Configure camera
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5 rounded-lg border border-tx3/10 bg-s2 px-3 py-2.5">
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  result.mode === 'done' ? 'bg-ac' : result.mode === 'failed' ? 'bg-rd' : 'animate-dot-pulse bg-am',
                )}
              />
              <div className="text-[0.68rem] leading-relaxed text-tx2">
                <RichText text={result.text} />
              </div>
            </div>
            {(result.mode === 'done' || result.mode === 'failed') && (
              <button
                onClick={() => (result.mode === 'failed' ? setStep(2) : onClose())}
                className="cursor-pointer rounded-lg border border-ac/40 bg-ac/10 px-4 py-2 text-[0.68rem] font-semibold text-ac transition-colors hover:bg-ac/15"
              >
                {result.mode === 'failed' ? 'Try again' : 'Done'}
              </button>
            )}
          </div>
        )}
      </Modal>

      <Dialog open={ssidError} onClose={() => setSsidError(false)} title="Missing network name" width="max-w-[340px]">
        <p className="text-[0.72rem] leading-relaxed text-tx2">
          Enter the Wi-Fi network name before configuring the camera.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setSsidError(false)}
            className="cursor-pointer rounded-lg border border-ac/40 bg-ac/10 px-3.5 py-1.5 text-[0.66rem] font-semibold text-ac transition-colors hover:bg-ac/15"
          >
            OK
          </button>
        </div>
      </Dialog>
    </>
  )
}
