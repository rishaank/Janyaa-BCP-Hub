import { useState, useRef, useEffect } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  CalendarRange,
  PiggyBank,
  Target,
  Hourglass,
  MapPin,
  UtensilsCrossed,
  Sparkles,
  History,
  Info,
  X,
  Lock,
  LogOut,
  LogIn,
  Sun,
  Moon,
  Monitor,
  Palette,
  ChevronsUpDown,
  ChevronDown,
  ClipboardCheck,
  Shield,
  User,
} from 'lucide-react'
import { Logo, Avatar, roleLabels, roleTones } from './ui'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { initials, getPendingRequestCount } from '../lib/api'
import { useRealtime } from '../lib/useRealtime'
import WhatsNew from './WhatsNew'
import CustomThemeModal from './CustomThemeModal'

// The affiliate-facing focus of the Hub — pinned at the top of the sidebar.
const affiliateNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true, public: true },
  { to: '/restaurants', label: 'Restaurant Affiliates', icon: UtensilsCrossed },
]

// Internal club operations — tucked under a collapsible "Members only" group.
const memberNav = [
  { to: '/members', label: 'Members', icon: Users },
  { to: '/events', label: 'Events & Meetings', icon: CalendarDays },
  { to: '/fundraising', label: 'Fundraising', icon: PiggyBank },
  { to: '/locations', label: 'Locations', icon: MapPin },
  { to: '/club-terms', label: 'Terms', icon: CalendarRange },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/auto-hours', label: 'Auto Hours', icon: Hourglass },
  { to: '/ai-planning', label: 'AI Planning', icon: Sparkles },
  { to: '/club', label: 'Club Info', icon: Info },
]

// Admin-only pages — a nested collapsible group within "Members only".
const adminNav = [{ to: '/history', label: 'History', icon: History }]

// Red notification count (e.g. unanswered hours requests).
function CountDot({ n }) {
  return (
    <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-coral-500 px-1.5 text-[11px] font-bold text-white">
      {n > 9 ? '9+' : n}
    </span>
  )
}

// One nav row. Guests see a locked row that routes to sign-in; members see the
// real link with an active-state highlight and an optional count badge.
function NavRow({ item, isGuest, onClose }) {
  const Icon = item.icon
  if (isGuest && !item.public) {
    return (
      <Link
        to="/login"
        onClick={onClose}
        title="Sign in to access"
        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-400 transition-colors hover:bg-ink-50 hover:text-ink-700"
      >
        <span className="flex items-center gap-3">
          <Icon size={18} />
          {item.label}
        </span>
        <Lock size={13} className="opacity-70" />
      </Link>
    )
  }
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
          isActive ? 'bg-blue-50 text-blue-700' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
        }`
      }
    >
      <span className="flex items-center gap-3">
        <Icon size={18} />
        {item.label}
      </span>
      {item.badge > 0 && <CountDot n={item.badge} />}
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }) {
  const { session, profile } = useAuth()
  const isGuest = !session
  const isAdmin = !!profile?.is_admin
  const isOpsLead = profile?.role === 'operations_lead'
  const location = useLocation()

  // Unanswered hours-request count → red badge for the operations lead.
  const [pending, setPending] = useState(0)
  const loadPending = () => (isOpsLead ? getPendingRequestCount().then(setPending) : setPending(0))
  useEffect(() => {
    loadPending()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpsLead])
  useRealtime(['hours_requests'], loadPending)

  const adminItems = isAdmin ? adminNav : []
  const memberItems = [
    ...memberNav,
    ...(isOpsLead ? [{ to: '/requests', label: 'Hours Requests', icon: ClipboardCheck, badge: pending }] : []),
  ]
  const matches = (i) => location.pathname === i.to || location.pathname.startsWith(i.to + '/')
  const onMemberPage = [...memberItems, ...adminItems].some(matches)
  const onAdminPage = adminItems.some(matches)

  // Hidden by default; auto-open when you're on a members-only (or admin) page so
  // the active item stays visible across refreshes and deep links.
  const [memberOpen, setMemberOpen] = useState(onMemberPage)
  const [adminOpen, setAdminOpen] = useState(onAdminPage)
  useEffect(() => {
    if (onMemberPage) setMemberOpen(true)
  }, [onMemberPage])
  useEffect(() => {
    if (onAdminPage) {
      setAdminOpen(true)
      setMemberOpen(true)
    }
  }, [onAdminPage])

  return (
    <>
      {open && <div className="ja-veil-in fixed inset-0 z-30 bg-ink-950/40 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink-200 bg-surface transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Logo />
          <button
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 lg:hidden"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {affiliateNav.map((item) => (
            <NavRow key={item.to} item={item} isGuest={isGuest} onClose={onClose} />
          ))}

          {/* Members-only operations — collapsed by default. */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setMemberOpen((v) => !v)}
              aria-expanded={memberOpen}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-700"
            >
              <span className="flex items-center gap-2">
                <Lock size={13} className="opacity-70" />
                Members only
              </span>
              <span className="flex items-center gap-1.5">
                {!memberOpen && pending > 0 && <CountDot n={pending} />}
                <ChevronDown size={14} className={`transition-transform ${memberOpen ? '' : '-rotate-90'}`} />
              </span>
            </button>
            <div className={`ja-collapse grid ${memberOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} inert={!memberOpen}>
              <div className="min-h-0 overflow-hidden">
                <div className="mt-0.5 space-y-0.5">
                  {memberItems.map((item) => (
                    <NavRow key={item.to} item={item} isGuest={isGuest} onClose={onClose} />
                  ))}

                  {/* Admin pages — nested collapsible group (admins only). */}
                  {isAdmin && (
                    <div className="mt-1 border-t border-ink-100 pt-1">
                      <button
                        type="button"
                        onClick={() => setAdminOpen((v) => !v)}
                        aria-expanded={adminOpen}
                        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-700"
                      >
                        <span className="flex items-center gap-2">
                          <Shield size={13} className="opacity-70" />
                          Admin pages
                        </span>
                        <ChevronDown size={14} className={`transition-transform ${adminOpen ? '' : '-rotate-90'}`} />
                      </button>
                      <div className={`ja-collapse grid ${adminOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} inert={!adminOpen}>
                        <div className="min-h-0 overflow-hidden">
                          <div className="mt-0.5 space-y-0.5">
                            {adminNav.map((item) => (
                              <NavRow key={item.to} item={item} isGuest={isGuest} onClose={onClose} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </nav>

        <WhatsNew />
        <AccountCard />
      </aside>
    </>
  )
}

// Signed-in user + account menu (theme, sign out) at the foot of the sidebar.
// Guests get a theme switch + a Sign-in call to action instead.
function AccountCard() {
  const { session, profile, user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const [themeModal, setThemeModal] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  if (!session) return <GuestCard theme={theme} setTheme={setTheme} />

  const name = profile?.name || user?.email?.split('@')[0] || 'Member'
  const role = roleLabels[profile?.role] || 'Member'

  return (
    <div className="relative border-t border-ink-200 p-3" ref={ref}>
      {open && (
        <div className="absolute inset-x-3 bottom-full mb-2 overflow-hidden rounded-xl border border-ink-200 bg-surface py-1 shadow-lg">
          <div className="border-b border-ink-100 px-3 py-2">
            <p className="truncate text-xs text-ink-500">{user?.email}</p>
          </div>
          <Link
            to={`/members/${user?.id}`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-b border-ink-100 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50"
          >
            <User size={16} /> Your profile
          </Link>
          <div className="border-b border-ink-100 px-3 py-2">
            <p className="mb-1.5 text-xs font-medium text-ink-500">Theme</p>
            <div className="flex gap-0.5 rounded-lg bg-ink-100 p-0.5">
              {[['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'System'], ['custom', Palette, 'Custom']].map(([val, Icon, label]) => (
                <button
                  key={val}
                  onClick={() => {
                    if (val === 'custom') {
                      setOpen(false)
                      setThemeModal(true)
                    } else setTheme(val)
                  }}
                  title={label}
                  aria-label={label}
                  className={`flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors ${
                    theme === val ? 'bg-surface text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-800'
                  }`}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-ink-600 hover:bg-ink-50"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-ink-50"
      >
        <Avatar initials={initials(name)} tone={roleTones[profile?.role] ?? 'blue'} src={profile?.avatar_url} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{name}</p>
          <p className="truncate text-xs text-ink-500">{role}</p>
        </div>
        <ChevronsUpDown size={16} className="shrink-0 text-ink-400" />
      </button>

      <CustomThemeModal open={themeModal} onClose={() => setThemeModal(false)} />
    </div>
  )
}

// Foot of the sidebar for logged-out visitors: theme switch + Sign in.
function GuestCard({ theme, setTheme }) {
  return (
    <div className="space-y-2 border-t border-ink-200 p-3">
      <div className="flex gap-0.5 rounded-lg bg-ink-100 p-0.5">
        {[['light', Sun, 'Light'], ['dark', Moon, 'Dark'], ['system', Monitor, 'System']].map(([val, Icon, label]) => (
          <button
            key={val}
            onClick={() => setTheme(val)}
            title={label}
            aria-label={label}
            className={`flex flex-1 items-center justify-center rounded-md py-1.5 transition-colors ${
              theme === val ? 'bg-surface text-ink-900 shadow-xs' : 'text-ink-500 hover:text-ink-800'
            }`}
          >
            <Icon size={14} />
          </button>
        ))}
      </div>
      <Link
        to="/login"
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
      >
        <LogIn size={16} /> Sign in
      </Link>
    </div>
  )
}
