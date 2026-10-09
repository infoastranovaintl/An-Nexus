import { useState } from 'react'
import {
  LuActivity as Activity,
  LuSiren as Siren,
  LuBellOff as SirenOff,
  LuPower as Power,
  LuRadio as Radio,
  LuWaves as Waves,
} from 'react-icons/lu'
import { useNexusStore } from '../../store/nexus'
import { bleCmd } from '../../lib/nexus/ble'
import { shortMac, MASTER_MAC, timeSince, cn } from '../../lib/utils'
import { Button, Panel, PanelTitle } from '../../components/ui/primitives'
import type { SensorKind, WaterReading } from '../../lib/nexus/sensors'
import { KIND_COLOR, KIND_ICON } from '../sensors/sensorMeta'
import { motion, AnimatePresence } from 'framer-motion'
import { sirenAll, rebootAll, requestAllData, checkSensorData } from './nodeActions'

// eslint-disable-next-line react-refresh/only-export-components
export function pingSelectedNode() {
  const store = useNexusStore.getState()
  const mac = store.selectedMac
  if (!mac || mac === MASTER_MAC) {
    store.addLog('Select a field node', 'ERR')
    return
  }
  bleCmd(`PING:${mac}`)
  store.addLog(`PING → ${shortMac(mac)}`, 'NOW')
}

const btnSm =
  'flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-[0.62rem] font-semibold transition-colors active:scale-[0.97] disabled:opacity-45'

type LiveRow = {
  key: string
  kind: SensorKind | 'water'
  value: number
  unit: string
  ts: number
}

export function CommandsPanel() {
  const selectedMac = useNexusStore((s) => s.selectedMac)
  const nodes = useNexusStore((s) => s.nodes)
  const bleConnected = useNexusStore((s) => s.bleConnected)
  const sensorReadings = useNexusStore((s) => s.sensorReadings)
  const waterLevels = useNexusStore((s) => s.waterLevels)
  const [busy, setBusy] = useState<string | null>(null)

  const isBase = selectedMac === MASTER_MAC
  const target = nodes[selectedMac || ''] ?? null
  const enabled = bleConnected && !!selectedMac && !isBase
  const onlineCount = Object.values(nodes).filter(
    (n) => n.online && !n.isMaster && n.mac !== MASTER_MAC,
  ).length

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label)
    await fn()
    setBusy(null)
  }

  const rows: LiveRow[] = []
  if (!isBase && selectedMac) {
    for (const s of sensorReadings[selectedMac] || []) {
      rows.push({ key: s.key, kind: s.kind, value: s.value, unit: s.unit, ts: s.ts })
    }
    const w = waterLevels[selectedMac]
    if (w && !rows.some((r) => r.kind === 'water')) {
      rows.push({ key: 'Water level', kind: 'water', value: w.v, unit: w.unit, ts: w.ts })
    }
  }

  return (
    <Panel className="flex min-h-0 flex-1 flex-col">
      <PanelTitle
        icon={<Activity size={13} />}
        badge={
          isBase ? undefined : (
            <span className="flex items-center gap-1.5">
              {rows.length > 0 && (
                <motion.span
                  className="h-1.5 w-1.5 rounded-full bg-gn"
                  animate={{ opacity: [1, 0.25, 1] }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                />
              )}
            </span>
          )
        }
      >
        {isBase ? 'Base Controls' : 'Live Data'}
      </PanelTitle>

      {!target && !isBase && (
        <div className="mb-1.5 flex h-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-tx3/20 bg-s0/50 text-[0.6rem] tracking-[0.04em] text-tx3">
          Select a node on the map
        </div>
      )}

      {isBase ? (
        /* ── BASE: controls for ALL nodes at once ── */
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-tx3/10 bg-s2 px-2 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-gn" />
            <span className="text-[0.62rem] text-tx2">
              {onlineCount} online node{onlineCount === 1 ? '' : 's'} will be targeted
            </span>
            {!bleConnected && <span className="ml-auto text-[0.55rem] font-bold text-rd uppercase">BLE off</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                className={cn(btnSm, 'border-ac/40 bg-ac/10 text-ac hover:bg-ac/15')}
                disabled={!bleConnected || busy !== null}
                onClick={() => void run('Request all', requestAllData)}
              >
                <Radio size={11} /> {busy === 'Request all' ? '…' : 'Request data (all)'}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className={cn(btnSm, 'border-gn/40 bg-gn/10 text-gn hover:bg-gn/15')}
                disabled={!bleConnected || busy !== null}
                onClick={() => {
                  setBusy('Siren on')
                  sirenAll(true)
                  setTimeout(() => setBusy(null), 700)
                }}
              >
                <Siren size={11} /> {busy === 'Siren on' ? '…' : 'Siren ON (all)'}
              </button>
              <button
                className={cn(btnSm, 'border-tx3/25 bg-s2 text-tx2 hover:border-tx3/40 hover:text-tx')}
                disabled={!bleConnected || busy !== null}
                onClick={() => {
                  setBusy('Siren off')
                  sirenAll(false)
                  setTimeout(() => setBusy(null), 700)
                }}
              >
                <SirenOff size={11} /> {busy === 'Siren off' ? '…' : 'Siren OFF (all)'}
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className={cn(btnSm, 'border-rd/40 bg-rd/10 text-rd hover:bg-rd/15')}
                disabled={!bleConnected || busy !== null}
                onClick={() => {
                  setBusy('Reboot')
                  rebootAll()
                  setTimeout(() => setBusy(null), 700)
                }}
              >
                <Power size={11} /> {busy === 'Reboot' ? '…' : 'Reboot (all)'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            className={cn(
              'nexus-scroll min-h-0 flex-1 flex-col gap-1 overflow-y-auto rounded-lg border border-tx3/10 bg-s2 p-1.5',
              rows.length > 0 ? 'flex' : 'flex items-center justify-center',
            )}
          >
            {!target ? (
              <span className="px-2 text-center text-[0.58rem] text-tx3">
                Pick a field node to see its live sensor reading
              </span>
            ) : rows.length === 0 ? (
              <span className="px-2 text-center text-[0.58rem] text-tx3">
                Waiting for live data from {target.name}…
                <br />
                {target.online ? (
                  <>
                    no readings yet — press <span className="text-tx2">Ping</span>, or{' '}
                    <span className="text-tx2">Check</span> to test the sensor
                  </>
                ) : (
                  <>
                    node is <span className="font-semibold text-rd">offline</span> — no data is expected until it
                    reconnects. Refresh the mesh to re-detect it.
                  </>
                )}
              </span>
            ) : (
              <AnimatePresence initial={false}>
                {rows.map((s) => {
                  const kind = s.kind
                  const Icon = kind === 'water' ? Waves : KIND_ICON[kind] || KIND_ICON.generic
                  const color = kind === 'water' ? KIND_COLOR.water : KIND_COLOR[kind] || KIND_COLOR.generic
                  const val = Math.abs(s.value) >= 100 ? s.value.toFixed(0) : s.value.toFixed(1)
                  return (
                    <motion.div
                      key={s.key}
                      layout
                      initial={{ opacity: 0, y: -3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center gap-2 rounded-md border border-tx3/10 bg-s1 px-2 py-1.5"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                        style={{ background: color + '1c', color }}
                      >
                        <Icon size={12} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[0.5rem] font-semibold tracking-[0.08em] text-tx3 uppercase">{s.key}</div>
                        {s.ts ? <div className="text-[0.46rem] text-tx3/70">{timeSince(s.ts * 1000)}</div> : null}
                      </div>
                      <div className="text-right font-mono text-[0.7rem] font-bold text-tx tabular-nums">
                        {val}
                        <span className="ml-0.5 text-[0.5rem] font-semibold text-tx3">{s.unit}</span>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>

          <div className="mt-1.5 flex flex-shrink-0 items-center gap-1.5">
            <Button size="sm" variant="blue" className="flex-1" disabled={!enabled} onClick={pingSelectedNode}>
              <Radio size={11} /> Ping Node
            </Button>
            <Button
              size="sm"
              variant="cyan"
              disabled={!enabled}
              onClick={() => target && void checkSensorData(target.mac)}
              data-tip="Check whether the sensor is sending data"
              data-tip-pos="top"
            >
              <Activity size={11} /> Check
            </Button>
          </div>
        </>
      )}
    </Panel>
  )
}

// keep WaterReading type referenced for clarity of the live rows
export type { WaterReading }
