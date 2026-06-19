import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Users, CalendarDays, PiggyBank, LayoutGrid } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// The five primary destinations. Home is public; the rest need a session, so a
// guest tapping one is routed to sign-in (mirrors the desktop sidebar's locked rows).
const TABS = [
  { label: 'Home', icon: Home, to: '/', match: (p) => p === '/', public: true },
  { label: 'Members', icon: Users, to: '/members', match: (p) => p.startsWith('/members') },
  { label: 'Events', icon: CalendarDays, to: '/events', match: (p) => p.startsWith('/events') },
  { label: 'Money', icon: PiggyBank, to: '/fundraising', match: (p) => p.startsWith('/fundraising') },
]

export default function BottomTabs({ moreOpen, onMore }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const isGuest = !session
  const path = location.pathname

  const onTab = TABS.find((t) => t.match(path))
  // "More" lights up whenever no primary tab matches (a More-menu page) or the sheet is open.
  const moreActive = moreOpen || !onTab

  return (
    <nav className="jh-tabs tb-pill" aria-label="Primary">
      <div className="jh-tabs-row">
        {TABS.map(({ label, icon: Icon, to, match, public: isPublic }) => {
          const on = !moreOpen && match(path)
          return (
            <button
              key={label}
              type="button"
              className={'jh-tab' + (on ? ' on' : '')}
              aria-current={on ? 'page' : undefined}
              onClick={() => navigate(isGuest && !isPublic ? '/login' : to)}
            >
              <span className="tb-pill-ic"><Icon size={22} /></span>
              <span>{label}</span>
            </button>
          )
        })}
        <button
          type="button"
          className={'jh-tab' + (moreActive ? ' on' : '')}
          aria-expanded={moreOpen}
          onClick={onMore}
        >
          <span className="tb-pill-ic"><LayoutGrid size={22} /></span>
          <span>More</span>
        </button>
      </div>
    </nav>
  )
}
