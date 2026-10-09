import { LuPhone as Phone, LuSiren as Siren, LuTriangleAlert as AlertTriangle } from 'react-icons/lu'
import { useNavigate } from 'react-router-dom'
import { useNexusStore } from '../../store/nexus'
import { Dialog } from '../ui/Dialog'

export function EmergencyModal() {
  const emergency = useNexusStore((s) => s.emergency)
  const setEmergency = useNexusStore((s) => s.setEmergency)
  const acknowledgeEmergency = useNexusStore((s) => s.acknowledgeEmergency)
  const setActiveConv = useNexusStore((s) => s.setActiveConv)
  const navigate = useNavigate()

  if (!emergency) return null

  const { nodeId, text, lat, lon } = emergency

  const openMaps = () => {
    window.open(`https://maps.google.com/?q=${lat},${lon}`, '_blank')
  }

  const acknowledge = () => {
    acknowledgeEmergency(nodeId)
    setEmergency(null)
  }

  return (
    <Dialog
      open
      onClose={() => setEmergency(null)}
      dismissible={false}
      width="max-w-[460px]"
      panelClassName="animate-offline-pulse border-rd/40 shadow-[0_12px_40px_rgba(16,24,40,0.14)]"
    >
      {/* siren header */}
      <div className="flex items-center gap-3 border-b border-rd/20 pb-4">
        <Siren size={28} className="text-rd" />
        <div>
          <div className="font-display text-[1rem] font-bold tracking-[0.06em] text-rd uppercase">Emergency</div>
          <div className="font-mono text-[0.6rem] tracking-[0.08em] text-tx3">NODE-{nodeId} · DISTRESS SIGNAL</div>
        </div>
      </div>

      <div className="py-5">
        <p className="text-[0.82rem] leading-relaxed text-tx">{text || 'A visitor has triggered a distress signal.'}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Info label="Node" value={`Node-${nodeId}`} />
          <Info label="Position" value={`${lat.toFixed(5)}, ${lon.toFixed(5)}`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={openMaps}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-ac/40 bg-ac/10 px-3 py-2.5 text-[0.68rem] font-semibold text-ac transition-colors hover:bg-ac/20"
        >
          <Phone size={13} /> View on map
        </button>
        <button
          onClick={() => {
            setActiveConv(nodeId)
            setEmergency(null)
            void navigate('/messages')
          }}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-ac/40 bg-ac/10 px-3 py-2.5 text-[0.68rem] font-semibold text-ac transition-colors hover:bg-ac/20"
        >
          <AlertTriangle size={13} /> Open chat
        </button>
      </div>

      <button
        onClick={acknowledge}
        className="mt-2 w-full cursor-pointer rounded-lg border border-rd/50 bg-rd/10 px-3 py-2.5 text-[0.68rem] font-semibold text-rd transition-colors hover:bg-rd/15"
      >
        Acknowledge emergency
      </button>
    </Dialog>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-tx3/10 bg-s2 px-2.5 py-2">
      <div className="text-[0.54rem] tracking-[0.08em] text-tx3 uppercase">{label}</div>
      <div className="mt-0.5 font-mono text-[0.68rem] text-tx">{value}</div>
    </div>
  )
}
