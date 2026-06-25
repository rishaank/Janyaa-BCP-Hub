import { useRef, useState, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Home, Users, CalendarDays, PiggyBank, MapPin, Target, CalendarRange,
  Sparkles, Info, UtensilsCrossed, Hourglass, History, ClipboardCheck,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// Every destination lives in the bottom bar now (no "More" sheet). The row scrolls
// horizontally; edge arrows appear when there's more to reach. Home is public; the
// rest need a session, so a guest tapping one is routed to sign-in.
const BASE_TABS = [
  { label: 'Home', icon: Home, to: '/', match: (p) => p === '/', public: true },
  { label: 'Members', icon: Users, to: '/members', match: (p) => p.startsWith('/members') },
  { label: 'Events', icon: CalendarDays, to: '/events', match: (p) => p.startsWith('/events') },
  { label: 'Money', icon: PiggyBank, to: '/fundraising', match: (p) => p.startsWith('/fundraising') },
  { label: 'Locations', icon: MapPin, to: '/locations', match: (p) => p.startsWith('/locations') },
  { label: 'Goals', icon: Target, to: '/goals', match: (p) => p.startsWith('/goals') },
  { label: 'Terms', icon: CalendarRange, to: '/club-terms', match: (p) => p.startsWith('/club-terms') },
  { label: 'AI', icon: Sparkles, to: '/ai-planning', match: (p) => p.startsWith('/ai-planning') || p.startsWith('/insights') || p.startsWith('/studio') },
  { label: 'Club', icon: Info, to: '/club', match: (p) => p === '/club' },
  { label: 'Food', icon: UtensilsCrossed, to: '/restaurants', match: (p) => p.startsWith('/restaurants') },
]
const ADMIN_TABS = [
  { label: 'Roles', icon: Hourglass, to: '/auto-hours', match: (p) => p.startsWith('/auto-hours') },
  { label: 'History', icon: History, to: '/history', match: (p) => p.startsWith('/history') },
]

export default function BottomTabs() {
  const location = useLocation()
  const navigate = useNavigate()
  const { session, profile } = useAuth()
  const isGuest = !session
  const isAdmin = !!profile?.is_admin
  const isOpsLead = profile?.role === 'operations_lead'
  const path = location.pathname

  const tabs = [
    ...BASE_TABS,
    ...(isOpsLead ? [{ label: 'Requests', icon: ClipboardCheck, to: '/requests', match: (p) => p.startsWith('/requests') }] : []),
    ...(isAdmin ? ADMIN_TABS : []),
  ]

  const scrollRef = useRef(null)
  const [edge, setEdge] = useState({ left: false, right: false })

  const updateEdges = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const left = el.scrollLeft > 4
    const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 4
    setEdge((e) => (e.left === left && e.right === right ? e : { left, right }))
  }, [])

  // Keep the active tab in view (e.g. an admin tab far down the row) + refresh arrows.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const active = el.querySelector('[data-on="true"]')
    if (active) active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    updateEdges()
  }, [path, updateEdges])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateEdges()
    el.addEventListener('scroll', updateEdges, { passive: true })
    window.addEventListener('resize', updateEdges)
    return () => {
      el.removeEventListener('scroll', updateEdges)
      window.removeEventListener('resize', updateEdges)
    }
  }, [updateEdges])

  const nudge = (dir) => {
    const el = scrollRef.current
    if (el) el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.7), behavior: 'smooth' })
  }

  return (
    <nav className="jh-tabs" aria-label="Primary">
      {edge.left && (
        <button type="button" className="jh-tabs-arrow left" aria-label="Scroll tabs left" onClick={() => nudge(-1)}>
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="jh-tabs-scroll" ref={scrollRef}>
        {tabs.map(({ label, icon: Icon, to, match, public: isPublic }) => {
          const on = match(path)
          return (
            <button
              key={to}
              type="button"
              data-on={on}
              className={'jh-tab' + (on ? ' on' : '')}
              aria-current={on ? 'page' : undefined}
              onClick={() => navigate(isGuest && !isPublic ? '/login' : to)}
            >
              <span className="tb-pill-ic"><Icon size={22} /></span>
              <span>{label}</span>
            </button>
          )
        })}
      </div>
      {edge.right && (
        <button type="button" className="jh-tabs-arrow right" aria-label="Scroll tabs right" onClick={() => nudge(1)}>
          <ChevronRight size={20} />
        </button>
      )}
    </nav>
  )
}
