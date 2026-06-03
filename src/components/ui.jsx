// Small shared UI primitives used across every page, on the Janyaa brand system.
// Color/radii/shadow tokens come from src/styles/tailwind-theme.css; legacy
// palette names are remapped to the brand in src/index.css.
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

// Brand mark: the real club badge + wordmark.
export function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/janyaa-logo.png" alt="Janyaa BCP" className="h-9 w-9 shrink-0" />
      {!compact && (
        <span className="font-display text-[17px] font-bold tracking-tight text-ink-900">
          Janyaa BCP Hub
        </span>
      )}
    </div>
  )
}

// Generic surface card — warm hairline border, soft warm shadow, 18px radius.
export function Card({ className = '', children }) {
  return (
    <div className={`rounded-xl border border-ink-200 bg-surface shadow-sm ${className}`}>
      {children}
    </div>
  )
}

// Page title (display face) + optional subtitle, overline badge, and action slot.
export function PageHeader({ title, subtitle, badge, action }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-h1 font-bold tracking-tight text-ink-900">{title}</h1>
          {badge && <Badge tone={badge.tone}>{badge.label}</Badge>}
        </div>
        {subtitle && <p className="mt-1 text-ink-600">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// Big number tile. Number uses the display face with tabular figures.
export function StatCard({ icon: Icon, label, value, hint, tone = 'green' }) {
  const tones = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-500',
    gold: 'bg-gold-100 text-gold-700',
    indigo: 'bg-green-50 text-green-600',
    emerald: 'bg-green-50 text-green-600',
    amber: 'bg-gold-100 text-gold-700',
    sky: 'bg-blue-50 text-blue-500',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-ink-600">{label}</p>
          <p className="mt-1.5 font-display text-3xl font-bold tracking-tight text-ink-900 tabular-nums">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
        </div>
        {Icon && (
          <span className={`grid h-10 w-10 place-items-center rounded-md ${tones[tone] ?? tones.green}`}>
            <Icon size={20} />
          </span>
        )}
      </div>
    </Card>
  )
}

// Color-coded status pill. Brand keys preferred; legacy keys aliased.
export function Badge({ tone = 'ink', children }) {
  const tones = {
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-600',
    gold: 'bg-gold-100 text-gold-800',
    coral: 'bg-coral-50 text-coral-700',
    ink: 'bg-ink-100 text-ink-700',
    // legacy aliases
    slate: 'bg-ink-100 text-ink-700',
    indigo: 'bg-green-50 text-green-700',
    emerald: 'bg-green-50 text-green-700',
    amber: 'bg-gold-100 text-gold-800',
    sky: 'bg-blue-50 text-blue-600',
    violet: 'bg-blue-50 text-blue-600',
    rose: 'bg-coral-50 text-coral-700',
    red: 'bg-coral-50 text-coral-700',
  }
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone] ?? tones.ink}`}>
      {children}
    </span>
  )
}

// Horizontal progress bar. Gold = fundraising/progress by default.
export function ProgressBar({ value, max, tone = 'gold' }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100))
  const tones = {
    green: 'bg-green-600',
    gold: 'bg-gold-500',
    blue: 'bg-blue-500',
    indigo: 'bg-green-600',
    emerald: 'bg-green-600',
    amber: 'bg-gold-500',
  }
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-150">
      <div className={`h-full rounded-full ${tones[tone] ?? tones.gold}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// Round initials avatar — solid brand fill, display initials.
export function Avatar({ initials, tone = 'green', src, size = 'md' }) {
  const sizes = { xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-20 w-20 text-2xl' }
  const dim = sizes[size] ?? sizes.md

  if (src) {
    return <img src={src} alt="" className={`${dim} shrink-0 rounded-full object-cover`} />
  }

  const tones = {
    green: 'bg-green-600',
    blue: 'bg-blue-500',
    gold: 'bg-gold-600',
    coral: 'bg-coral-500',
    ink: 'bg-ink-400',
    indigo: 'bg-green-600',
    emerald: 'bg-green-600',
    amber: 'bg-gold-600',
    sky: 'bg-blue-500',
    violet: 'bg-blue-600',
    rose: 'bg-coral-500',
    slate: 'bg-ink-400',
  }
  return (
    <span className={`grid ${dim} shrink-0 place-items-center rounded-full font-display font-bold text-white ${tones[tone] ?? tones.green}`}>
      {initials}
    </span>
  )
}

// Friendly placeholder for modules that aren't wired up yet.
export function EmptyState({ icon: Icon, title, children }) {
  return (
    <Card className="grid place-items-center p-10 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-400">
        {Icon && <Icon size={24} />}
      </span>
      <h3 className="mt-4 font-display text-h4 font-semibold text-ink-900">{title}</h3>
      <div className="mt-1 max-w-sm text-sm text-ink-600">{children}</div>
    </Card>
  )
}

// Button. Green = the single primary action; blue secondary; gold for fundraising.
// Pass `loading` to spin the icon (e.g. during a slow regenerate/sync).
export function Button({ children, variant = 'primary', icon: Icon, loading = false, ...props }) {
  const variants = {
    primary: 'bg-green-600 text-white hover:bg-green-700 shadow-xs',
    secondary: 'bg-blue-500 text-white hover:bg-blue-600',
    accent: 'bg-gold-400 text-ink-950 hover:bg-gold-500',
    soft: 'bg-surface text-ink-800 border border-ink-300 hover:bg-ink-50',
    danger: 'bg-surface text-coral-700 border border-coral-200 hover:bg-coral-50',
  }
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-200 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant] ?? variants.primary}`}
      {...props}
    >
      {Icon && <Icon size={16} className={loading ? 'animate-spin' : undefined} />}
      {children}
    </button>
  )
}

// Pulsing placeholder for loading states.
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-ink-100 ${className}`} />
}

// ---- shared label/tone helpers ----

export const roleLabels = {
  operations_lead: 'Operations Lead',
  event_lead: 'Event Lead',
  pr_lead: 'PR and Tech Lead',
  outreach_lead: 'Outreach Lead',
  secretary: 'Secretary',
  education_lead: 'Education Lead',
  member: 'Member', // default until a new member picks a role
}

// The selectable roles (excludes the 'member' default placeholder).
export const roleOptions = [
  'operations_lead',
  'event_lead',
  'pr_lead',
  'outreach_lead',
  'secretary',
  'education_lead',
]

export const roleTones = {
  operations_lead: 'green',
  event_lead: 'blue',
  pr_lead: 'gold',
  outreach_lead: 'blue',
  secretary: 'green',
  education_lead: 'gold',
  member: 'ink',
}

export const statusTones = {
  // locations
  recurring_partner: 'green',
  approved: 'blue',
  contacted: 'gold',
  prospect: 'ink',
  declined: 'coral',
  // restaurants
  partnered: 'green',
  past_partner: 'ink',
  // videos
  published: 'green',
  in_progress: 'gold',
  claimed: 'blue',
  archived: 'ink',
  // events
  upcoming: 'blue',
  past: 'ink',
}

export const statusLabels = {
  recurring_partner: 'Recurring partner',
  approved: 'Approved',
  contacted: 'Contacted',
  prospect: 'Prospect',
  declined: 'Declined',
  partnered: 'Partnered',
  past_partner: 'Past partner',
  published: 'Published',
  in_progress: 'In progress',
  claimed: 'Claimed',
  archived: 'Archived',
  upcoming: 'Upcoming',
  past: 'Past',
}

export const formatDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

// Centered modal dialog. Renders nothing when `open` is false.
export function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-950/50" onClick={onClose} />
      <div className="ja-pop relative z-10 w-full max-w-md rounded-2xl bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-ink-200 px-5 py-4">
          <h2 className="font-display text-h4 font-semibold text-ink-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// Labeled input/select for modal forms.
export function FormField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink-800">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-md border border-ink-300 bg-surface px-3 py-2.5 text-sm text-ink-900 placeholder-ink-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100'
