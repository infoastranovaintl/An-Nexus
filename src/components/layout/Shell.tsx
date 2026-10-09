import { useEffect } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  SquaresFour,
  Broadcast,
  Speedometer,
  VideoCamera,
  Bell,
  ChatsCircle,
  GearSix,
} from '@phosphor-icons/react'
import { useNexusStore } from '../../store/nexus'
import { cn } from '../../lib/utils'
import { startAutoPoll, stopAutoPoll } from '../../views/dashboard/nodeActions'

export function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const hasCritical = useNexusStore((s) => s.alerts.some((a) => a.severity === 'critical'))
  const hasEmergency = useNexusStore((s) =>
    Object.values(s.convMeta).some((m) => m.emergency && m.status !== 'resolved'),
  )
  const danger = (to: string) =>
    (to === '/alerts' && hasCritical) || (to === '/messages' && hasEmergency)

  const bleConnected = useNexusStore((s) => s.bleConnected)
  useEffect(() => {
    if (bleConnected) startAutoPoll()
    else stopAutoPoll()
    return () => stopAutoPoll()
  }, [bleConnected])

  return (
<div
        className="flex h-full gap-2 overflow-hidden px-2 lg:px-2.5"
      >
        <div className="relative z-20 hidden w-[3.25rem] flex-shrink-0 self-center md:flex md:flex-col md:items-start md:gap-1.5 md:py-2.5 md:pl-1.5">
          <nav className="flex w-full flex-col items-start gap-1" aria-label="Main navigation">
{NAV_ITEMS.map(({ to, label, icon: Icon }) => {
              return (
                <div key={to} className="relative">
                  <NavLink
                    to={to}
                    end={to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'group/nav relative flex h-10 w-10 cursor-pointer items-center overflow-hidden rounded-full border border-tx3/15 bg-s1 shadow-sm transition-all duration-300 ease-out hover:w-[10rem] hover:shadow-md',
                        isActive
                          ? 'text-white'
                          : danger(to)
                            ? 'text-rd'
                            : 'text-tx2 hover:text-ac',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                             className={cn(
                              'absolute inset-0 rounded-full',
                              danger(to) ? 'bg-rd' : 'bg-ac',
                           )}
                          />
                        )}
                        <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center">
                          <Icon size={21} weight="bold" />
                        </span>
                        <span className="relative z-10 ml-0 max-w-0 overflow-hidden whitespace-nowrap text-[0.72rem] font-semibold tracking-[0.02em] opacity-0 transition-all duration-300 group-hover/nav:ml-1 group-hover/nav:max-w-[8rem] group-hover/nav:opacity-100">
                          {label}
                        </span>
                      </>
                    )}
                  </NavLink>
                </div>
              )
            })}
          </nav>

          <div className="flex w-full flex-col items-start gap-1">
            <div className="h-px w-6 self-center rounded-full bg-tx3/15" />
            <button
              onClick={() => navigate('/settings')}
              className={cn(
                'group/settings relative flex h-10 w-10 cursor-pointer items-center overflow-hidden rounded-full border border-tx3/15 bg-s1 shadow-sm transition-all duration-300 ease-out hover:w-[10rem] hover:shadow-md',
                pathname === '/settings'
                  ? 'border-ac bg-ac text-white'
                  : 'text-tx2 hover:text-ac',
              )}
            >
              <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center">
                <GearSix size={21} weight="bold" />
              </span>
              <span className="relative z-10 ml-0 max-w-0 overflow-hidden whitespace-nowrap text-[0.72rem] font-semibold tracking-[0.02em] opacity-0 transition-all duration-300 group-hover/settings:ml-1 group-hover/settings:max-w-[8rem] group-hover/settings:opacity-100">
                Settings
              </span>
            </button>
          </div>
         </div>

<div className="flex-1 flex flex-col min-h-0 py-5">
            <main className="flex-1 min-h-0 flex flex-col overflow-y-auto">{children}</main>
          </div>

        <div>
          <MobileNav hasEmergency={hasEmergency} hasCritical={hasCritical} />
        </div>
      </div>
  )
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: SquaresFour },
  { to: '/connections', label: 'Connections', icon: Broadcast },
  { to: '/sensors', label: 'Sensors', icon: Speedometer },
  { to: '/cctv', label: 'CCTV', icon: VideoCamera },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/messages', label: 'Messages', icon: ChatsCircle },
]

function MobileNav({
  hasEmergency,
  hasCritical,
}: {
  hasEmergency: boolean
  hasCritical: boolean
}) {
  const danger = (to: string) =>
    (to === '/alerts' && hasCritical) || (to === '/messages' && hasEmergency)
  return (
    <nav className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-tx3/15 bg-s1/95 p-1.5 shadow-[0_8px_32px_rgba(16,24,40,0.18)] backdrop-blur-md md:hidden">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => {
        return (
          <div key={to} className="relative">
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                cn(
                  'relative flex min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-full px-2 py-1.5 text-[0.5rem] font-bold tracking-[0.04em] uppercase transition-colors duration-300',
                  isActive
                    ? 'text-white'
                    : danger(to)
                      ? 'text-rd'
                      : 'text-tx2',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                       className={cn(
                        'absolute inset-0 rounded-full',
                        danger(to) ? 'bg-rd' : 'bg-ac',
                       )}
                     />
                  )}
                  <span className="relative z-10 flex h-7 w-7 items-center justify-center">
                    <Icon size={18} weight="bold" />
                  </span>
                  <span className="relative z-10">{label}</span>
                </>
              )}
            </NavLink>
          </div>
        )
      })}
</nav>
  )
}
