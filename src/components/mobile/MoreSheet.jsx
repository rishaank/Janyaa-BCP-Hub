import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import {
  X, Lock, Shield, Users, CalendarDays, PiggyBank, MapPin, Target,
  CalendarRange, Sparkles, Info, UtensilsCrossed, Hourglass, History, ClipboardCheck,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// Members-only destinations — a full index (the four tabs appear here too, so More
// works as a single map of the app), in the design's order + tones.
const PAGES = [
  { label: 'Members & Hours', to: '/members', icon: Users, tone: 'green' },
  { label: 'Events & Meetings', to: '/events', icon: CalendarDays, tone: 'blue' },
  { label: 'Fundraising', to: '/fundraising', icon: PiggyBank, tone: 'gold' },
  { label: 'Locations', to: '/locations', icon: MapPin, tone: 'green' },
  { label: 'Goals', to: '/goals', icon: Target, tone: 'gold' },
  { label: 'Terms', to: '/club-terms', icon: CalendarRange, tone: 'blue' },
  { label: 'AI Planning', to: '/ai-planning', icon: Sparkles, tone: 'gold' },
  { label: 'Club Info', to: '/club', icon: Info, tone: 'blue' },
  { label: 'Restaurants', to: '/restaurants', icon: UtensilsCrossed, tone: 'coral' },
]

const ADMIN_PAGES = [
  { label: 'Role Hours', to: '/auto-hours', icon: Hourglass, tone: 'blue' },
  { label: 'History', to: '/history', icon: History, tone: 'blue' },
]

function Tile({ to, icon: Icon, label, tone, isGuest, onClose }) {
  return (
    <Link to={isGuest ? '/login' : to} className="more-tile" onClick={onClose}>
      <span className={'more-tile-ic tone-' + tone}><Icon size={22} /></span>
      <span className="more-tile-lab">{label}</span>
    </Link>
  )
}

export default function MoreSheet({ onClose }) {
  const { session, profile } = useAuth()
  const isGuest = !session
  const isAdmin = !!profile?.is_admin
  const isOpsLead = profile?.role === 'operations_lead'

  const adminPages = [
    ...(isAdmin ? ADMIN_PAGES : []),
    ...(isOpsLead ? [{ label: 'Hours Requests', to: '/requests', icon: ClipboardCheck, tone: 'gold' }] : []),
  ]

  // Play the slide-down animation, then actually unmount when it ends.
  const [closing, setClosing] = useState(false)
  const requestClose = () => setClosing(true)

  return createPortal(
    <>
      <div className={'sheet-scrim' + (closing ? ' sheet-scrim-closing' : '')} onClick={requestClose} />
      <div
        className={'sheet' + (closing ? ' sheet-closing' : '')}
        role="dialog"
        aria-label="More"
        onAnimationEnd={(e) => { if (closing && e.target === e.currentTarget) onClose() }}
      >
        <div className="sheet-title-row">
          <span className="sheet-title">More</span>
          <button className="sheet-x" onClick={requestClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="more-group"><Lock size={12} /> Members only</div>
        <div className="more-grid">
          {PAGES.map((p) => <Tile key={p.to} {...p} isGuest={isGuest} onClose={onClose} />)}
        </div>

        {adminPages.length > 0 && (
          <>
            <div className="more-group" style={{ paddingTop: 18 }}><Shield size={12} /> Admin</div>
            <div className="more-grid">
              {adminPages.map((p) => <Tile key={p.to} {...p} isGuest={isGuest} onClose={onClose} />)}
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  )
}
