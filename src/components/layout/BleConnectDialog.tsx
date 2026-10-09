import { LuBluetooth as Bluetooth, LuRefreshCw as RefreshCw, LuWifiOff as WifiOff, LuSearch as Search, LuCircleDot as Dot } from 'react-icons/lu'
import { useNexusStore } from '../../store/nexus'
import { bleConnect, bleDisconnect, selectBleDevice, cancelBleScan } from '../../lib/nexus/ble'
import { BASE_STATION_NAME } from '../../lib/utils'
import { Dialog } from '../ui/Dialog'
import { cn } from '../../lib/utils'

interface Props {
  open: boolean
  onClose: () => void
}

export function BleConnectDialog({ open, onClose }: Props) {
  const bleConnected = useNexusStore((s) => s.bleConnected)
  const bleDeviceName = useNexusStore((s) => s.bleDeviceName)
  const bleScanning = useNexusStore((s) => s.bleScanning)
  const bleDevices = useNexusStore((s) => s.bleDevices)
  const nodes = useNexusStore((s) => s.nodes)
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI?.isElectron

  const supported = typeof navigator !== 'undefined' && !!navigator.bluetooth
  const list = Object.values(nodes)
  const devices = [...bleDevices].sort((a, b) => {
    const aBase = a.deviceName === BASE_STATION_NAME ? 0 : 1
    const bBase = b.deviceName === BASE_STATION_NAME ? 0 : 1
    return aBase - bBase || String(a.deviceName).localeCompare(String(b.deviceName))
  })

  const handleClose = () => {
    if (bleScanning) cancelBleScan()
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Base Station" width="max-w-[500px]">
      {!supported ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-tx3/10 bg-s2/50 px-6 py-8 text-center">
          <WifiOff size={24} className="text-tx3" />
          <div>
            <p className="text-[0.72rem] font-bold text-tx">Bluetooth not available</p>
            <p className="mt-1 text-[0.62rem] leading-relaxed text-tx2">
              Web Bluetooth isn't supported in this browser.
              <br />
              Use Chrome or Edge on desktop.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* status card */}
          <div
            className={cn(
              'flex items-center gap-4 rounded-2xl border-2 px-5 py-4 transition-colors',
              bleConnected
                ? 'border-gn/25 bg-gn/5'
                : bleScanning
                  ? 'border-am/25 bg-am/5'
                  : 'border-tx3/10 bg-s2/30',
            )}
          >
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                bleConnected ? 'bg-gn/15' : bleScanning ? 'bg-am/15' : 'bg-tx3/10',
              )}
            >
              <Bluetooth
                size={22}
                className={cn(
                  bleConnected ? 'text-gn' : bleScanning ? 'text-am animate-pulse' : 'text-tx3',
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[0.78rem] font-bold text-tx">
                {bleConnected
                  ? bleDeviceName || BASE_STATION_NAME
                  : bleScanning
                    ? 'Scanning…'
                    : 'Not connected'}
              </div>
              <div className="mt-1 text-[0.64rem] text-tx3">
                {bleConnected
                  ? `${list.length} node${list.length === 1 ? '' : 's'} linked`
                  : bleScanning
                    ? 'Looking for nearby devices'
                    : 'Tap scan to discover devices'}
              </div>
            </div>
            <span
              className={cn(
                'h-3 w-3 shrink-0 rounded-full',
                bleConnected ? 'bg-gn' : bleScanning ? 'bg-am' : 'bg-tx3/40',
              )}
            />
          </div>

          {/* scanning device list */}
          {bleScanning ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 px-0.5 text-[0.66rem] font-bold uppercase tracking-[0.08em] text-tx3">
                <Search size={11} />
                Available devices{devices.length > 0 ? ` · ${devices.length}` : ''}
              </div>

              {devices.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-tx3/15 bg-s2/20 px-4 py-6 text-center">
                  <RefreshCw size={18} className="animate-spin text-am" />
                  <div>
                    <p className="text-[0.66rem] font-semibold text-tx2">Listening…</p>
                    <p className="mt-0.5 text-[0.56rem] text-tx3">Power on the base station nearby</p>
                  </div>
                </div>
              ) : (
                <div className="nexus-scroll flex max-h-60 flex-col gap-1.5 overflow-y-auto">
                  {devices.map((d) => {
                    const isBase = d.deviceName === BASE_STATION_NAME
                    const hasName = !!d.deviceName && d.deviceName !== 'Unknown or Unsupported Device'
                    return (
                      <div
                        key={d.deviceId}
                        className="group flex items-center gap-3.5 rounded-xl border border-tx3/10 bg-s2/30 px-4 py-3 transition-colors hover:border-ac/20 hover:bg-s2/60"
                      >
                        <span
                          className={cn(
                            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                            isBase ? 'bg-gn/10' : 'bg-ac/10',
                          )}
                        >
                          <Bluetooth size={16} className={isBase ? 'text-gn' : 'text-ac'} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-[0.74rem] font-bold text-tx">
                              {hasName ? d.deviceName : 'BLE device'}
                            </p>
                            {isBase && (
                              <span className="shrink-0 rounded-full bg-gn/15 px-2 py-0.5 text-[0.52rem] font-bold text-gn">
                                BASE
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 font-mono text-[0.56rem] text-tx3">{d.deviceId}</p>
                        </div>
                        <button
                          onClick={() => selectBleDevice(d.deviceId)}
                          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-2 border-ac/30 bg-ac/8 px-4 py-2 text-[0.66rem] font-bold text-ac transition-all hover:border-ac/50 hover:bg-ac/12"
                        >
                          <Bluetooth size={11} /> Join
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                {!isElectron && (
                  <p className="min-w-0 flex-1 text-[0.54rem] leading-relaxed text-tx3">
                    Browser: pick a device from the system chooser.
                  </p>
                )}
                <button
                  onClick={cancelBleScan}
                  className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-full border border-tx3/15 bg-s2/50 px-3.5 py-1.5 text-[0.6rem] font-semibold text-tx2 transition-colors hover:bg-tx3/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : !bleConnected ? (
            <button
              onClick={() => void bleConnect()}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-2 border-ac/30 bg-ac/8 px-5 py-3.5 text-[0.78rem] font-bold text-ac transition-all hover:border-ac/50 hover:bg-ac/12"
            >
              <Bluetooth size={16} /> Scan for devices
            </button>
          ) : (
            <button
              onClick={bleDisconnect}
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border-2 border-rd/25 bg-rd/5 px-5 py-3.5 text-[0.78rem] font-bold text-rd transition-all hover:border-rd/40 hover:bg-rd/10"
            >
              <WifiOff size={16} /> Disconnect
            </button>
          )}

          {/* nodes list when connected */}
          {bleConnected && list.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 px-0.5 text-[0.6rem] font-bold uppercase tracking-[0.08em] text-tx3">
                <Dot size={10} />
                Connected nodes · {list.length}
              </div>
              <div className="nexus-scroll flex max-h-48 flex-col gap-1 overflow-y-auto">
                {list.map((n) => (
                  <div
                    key={n.mac}
                    className="flex items-center gap-2.5 rounded-xl border border-tx3/10 bg-s2/30 px-3 py-2"
                  >
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        n.online ? 'bg-gn' : 'bg-rd',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-[0.66rem] font-bold text-tx">{n.name}</span>
                    {n.rssi ? (
                      <span className="font-mono text-[0.52rem] text-tx3">{n.rssi} dBm</span>
                    ) : null}
                    <span className="font-mono text-[0.52rem] text-tx3">
                      {n.id === 0 ? 'gw' : `node-${n.id}`}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[0.48rem] font-bold',
                        n.online ? 'bg-gn/10 text-gn' : 'bg-rd/10 text-rd',
                      )}
                    >
                      {n.online ? 'online' : 'off'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Dialog>
  )
}
