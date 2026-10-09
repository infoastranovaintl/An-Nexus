import { useState } from 'react'

import { useNexusStore } from '../../store/nexus'
import { NodeList } from '../dashboard/NodeList'
import { TopologyCanvas } from '../dashboard/TopologyCanvas'
import { BleConnectDialog } from '../../components/layout/BleConnectDialog'
import { cn } from '../../lib/utils'
import { LuBluetooth as Bluetooth, LuWifi as Wifi } from 'react-icons/lu'

export function ConnectionsView() {
  const [showNodes, setShowNodes] = useState(false)
  const bleDialogOpen = useNexusStore((s) => s.bleDialogOpen)
  const setBleDialog = useNexusStore((s) => s.setBleDialog)

  function DynamicIsland() {
    const bleConnected = useNexusStore((s) => s.bleConnected)
    const bleScanning = useNexusStore((s) => s.bleScanning)
    const wsConnected = useNexusStore((s) => s.wsConnected)
    const bleDeviceName = useNexusStore((s) => s.bleDeviceName)
    const live = bleConnected || wsConnected

    return (
      <button
        type="button"
        onClick={() => setBleDialog(true)}
        className="flex h-10 items-center gap-2.5 rounded-full border-2 border-tx3/15 bg-s1 px-3 transition-all hover:border-ac/25"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center">
          {live ? (
            <Bluetooth size={14} className="text-ac" />
          ) : bleScanning ? (
            <Wifi size={14} className="text-am" />
          ) : (
            <Wifi size={14} className="text-tx3" />
          )}
        </span>
        <span className="truncate text-[0.68rem] font-bold text-tx">
          {bleScanning
            ? 'Scanning…'
            : bleConnected
              ? bleDeviceName || 'BLE Connected'
              : wsConnected
                ? 'WS Gateway'
                : 'Not connected'}
        </span>
        <span className="ml-auto shrink-0 rounded-full bg-ac px-3 py-1.5 text-[0.56rem] font-bold text-white">
          {live ? 'Manage' : 'Connect'}
        </span>
      </button>
    )
  }

  return (
       <div className="relative flex h-full gap-2 overflow-hidden py-3 pr-3">
      {/* scrim for mobile overlays */}
      {showNodes && (
        <div className="absolute inset-0 z-[4990] bg-tx/40 backdrop-blur-[2px] lg:hidden" onClick={() => setShowNodes(false)} />
      )}

      {/* LEFT PANEL — mobile: overlay · desktop: static */}
      <aside
        className={cn(
          'absolute inset-y-0 left-0 z-[5000] flex h-full w-[360px] max-w-[86vw] flex-col gap-2 overflow-hidden rounded-r-2xl border border-tx3/10 bg-s1 p-2 shadow-[0_12px_40px_rgba(16,24,40,0.12)] transition-transform duration-200 sm:rounded-r-3xl',
          showNodes ? 'translate-x-0' : '-translate-x-[105%]',
          'lg:static lg:z-auto lg:w-[340px] lg:translate-x-0 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none xl:w-[380px]',
        )}
      >
        <div className="nexus-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto lg:overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex min-h-0 flex-1 flex-col">
              <NodeList />
            </div>
          </div>
        </div>
      </aside>

      {/* CENTER */}
      <section className="relative flex h-full min-w-0 flex-1 flex-col gap-2">
        {/* top bar — holds notifications center, connection right */}
        <div className="relative flex h-11 items-center justify-center">
          {/* connection — right */}
          <div className="absolute right-0 z-[200]">
            <DynamicIsland />
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <TopologyCanvas
            onToggleNodes={() => setShowNodes((v) => !v)}
          />
        </div>
      </section>

      <BleConnectDialog open={bleDialogOpen} onClose={() => setBleDialog(false)} />
    </div>
  )
}
