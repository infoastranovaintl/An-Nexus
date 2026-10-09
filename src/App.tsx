import { useEffect } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import { Shell } from './components/layout/Shell'
import { EmergencyModal } from './components/layout/EmergencyModal'
import { TooltipLayer } from './components/ui/TooltipLayer'
import { DynamicIslandNotifications } from './components/ui/DynamicIsland'
import { PopupCenter } from './components/ui/PopupCenter'
import { DashboardView } from './views/dashboard/DashboardView'
import { ConnectionsView } from './views/connections/ConnectionsView'
import { SensorsView } from './views/sensors/SensorsView'
import { CctvView } from './views/cctv/CctvView'
import { MessagesView } from './views/messages/MessagesView'
import { AlertsView } from './views/alerts/AlertsView'
import { SettingsView } from './views/settings/SettingsView'
import { registerNavigate } from './lib/nav'
import { useNexusStore } from './store/nexus'
import { tryAutoReconnect, initBleChooser, destroyBleChooser } from './lib/nexus/ble'
import { MASTER_MAC } from './lib/utils'
import { initSync, destroySync } from './lib/sync/service'
import { startAlertEngine, stopAlertEngine } from './lib/alertEngine'

export function App() {
  const navigate = useNavigate()
  useEffect(() => {
    registerNavigate(navigate)
    const t = window.setInterval(() => useNexusStore.getState().sweepNodes(), 1000)
    return () => window.clearInterval(t)
  }, [navigate])

  useEffect(() => {
    /* persisted statuses may be stale (offline/paired) — reset field nodes
       to truthful defaults; the base re-syncs them via HELLO/PAIRED/NODE */
    const store = useNexusStore.getState()
    for (const [mac, n] of Object.entries(store.nodes)) {
      if (n.isMaster || mac === MASTER_MAC) continue
      if (n.online || n.paired) store.updateNode(mac, { online: false, paired: false })
    }
    const boot = window.setTimeout(() => {
      void tryAutoReconnect().then((ok) => {
        if (!ok) useNexusStore.getState().updateNode(MASTER_MAC, { online: false })
      })
    }, 1000)
    const onShow = () => {
      if (document.visibilityState !== 'visible') return
      void tryAutoReconnect()
    }
    window.addEventListener('pageshow', onShow)
    document.addEventListener('visibilitychange', onShow)

    initSync()
    initBleChooser()
    startAlertEngine()

    return () => {
      window.clearTimeout(boot)
      window.removeEventListener('pageshow', onShow)
      document.removeEventListener('visibilitychange', onShow)
      destroySync()
      destroyBleChooser()
      stopAlertEngine()
    }
  }, [])

  return (
    <div className="h-full">
      <Shell>
        <Routes>
          <Route path="/" element={<DashboardView />} />
          <Route path="/connections" element={<ConnectionsView />} />
          <Route path="/sensors" element={<SensorsView />} />
          <Route path="/cctv" element={<CctvView />} />
          <Route path="/messages" element={<MessagesView />} />
          <Route path="/alerts" element={<AlertsView />} />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<DashboardView />} />
        </Routes>
      </Shell>
      <EmergencyModal />
      <TooltipLayer />
      <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[5000]">
        <DynamicIslandNotifications />
      </div>
      <PopupCenter />
    </div>
  )
}
