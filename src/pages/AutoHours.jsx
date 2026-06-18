import { useEffect, useState } from 'react'
import { Clock, Info, Check, Loader2 } from 'lucide-react'
import { PageHeader, Card, AccessChip, EmptyState, roleLabels } from '../components/ui'
import { getRoleHoursRules, updateRoleHoursRule, grantRoleMonth } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../lib/useRealtime'

const cadenceLabel = { monthly: 'every month', per_event: 'per new event' }
// Stable display order, regardless of how the rows come back.
const ORDER = ['operations_lead', 'event_lead', 'pr_lead', 'outreach_lead', 'secretary', 'education_lead']

// Current month + days until the next monthly auto-grant (the 1st), in PST.
function pstNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  )
  return { period: `${p.year}-${p.month}`, y: Number(p.year), m: Number(p.month), d: Number(p.day) }
}
function daysUntilNextGrant() {
  const { y, m, d } = pstNow()
  const today = new Date(y, m - 1, d)
  const nextFirst = new Date(y, m, 1) // 1st of next month
  return Math.max(1, Math.round((nextFirst - today) / 86400000))
}

export default function AutoHours() {
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const period = pstNow().period
  const days = daysUntilNextGrant()

  const load = () =>
    getRoleHoursRules().then((d) => {
      setRules(d)
      setLoading(false)
    })

  useEffect(() => {
    load()
  }, [])
  useRealtime(['role_hours_rules'], load)

  async function grant(role) {
    await grantRoleMonth(role)
    await load()
  }

  const ordered = [...rules].sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role))

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="Role Hours" />
        <EmptyState icon={Clock} title="Admins only">
          Role-hours rules are managed by club admins.
        </EmptyState>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Role Hours"
        badge={<AccessChip mode="edit" />}
        subtitle="Volunteer hours that accrue automatically based on a member's role."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-100 px-3 py-1.5 font-mono text-2xs font-semibold uppercase tracking-[0.06em] text-ink-600">
            <Clock size={13} /> Next auto grant in {days} {days === 1 ? 'day' : 'days'}
          </span>
        }
      />

      <Card className="mb-6 flex items-start gap-3 border-blue-200 bg-blue-50/60 p-4 text-sm text-ink-700">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
        <div className="space-y-1">
          <p><span className="font-semibold">How it works.</span> These hours are added automatically, on top of event sign-ups.</p>
          <ul className="list-disc space-y-0.5 pl-5 text-ink-600">
            <li><span className="font-medium text-ink-800">Every month</span> grants on the 1st — or use a role’s <span className="font-medium text-ink-800">Grant Now</span> to grant it early.</li>
            <li><span className="font-medium text-ink-800">Per new event</span> grants the moment an event is created.</li>
            <li>Role hours accrue going forward — set each member’s accurate hours so far from their profile.</li>
          </ul>
          <p className="pt-1 text-ink-600">
            <span className="font-semibold text-ink-800">Events &amp; meetings are separate.</span> Hours from signing
            up for an event or attending a meeting are added automatically once that event or meeting has taken place.
          </p>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-[68px] animate-pulse bg-ink-50" />
          ))}
        </div>
      ) : (
        <div className="ja-stagger space-y-3">
          {ordered.map((rule) => (
            <RuleRow key={rule.role} rule={rule} granted={rule.last_granted_month === period} onGrant={grant} />
          ))}
        </div>
      )}
    </>
  )
}

function RuleRow({ rule, granted, onGrant }) {
  const [hours, setHours] = useState(rule.hours)
  const [cadence, setCadence] = useState(rule.cadence)
  const [active, setActive] = useState(rule.active)
  const [saved, setSaved] = useState(false)
  const [granting, setGranting] = useState(false)

  useEffect(() => {
    setHours(rule.hours)
    setCadence(rule.cadence)
    setActive(rule.active)
  }, [rule.hours, rule.cadence, rule.active])

  async function save(fields) {
    await updateRoleHoursRule(rule.role, fields)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }
  async function doGrant() {
    setGranting(true)
    await onGrant(rule.role)
    setGranting(false)
  }

  return (
    <Card className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${!active ? 'opacity-60' : ''} ${granted ? 'border-green-300' : ''}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${granted ? 'bg-green-50 text-green-600' : 'bg-ink-100 text-ink-500'}`}>
          {granted ? <Check size={18} strokeWidth={2.5} /> : <Clock size={17} />}
        </span>
        <div className="min-w-0">
          <p className="font-medium text-ink-900">{roleLabels[rule.role] ?? rule.role}</p>
          <p className="text-xs text-ink-500">
            {Number(hours)} {Number(hours) === 1 ? 'hour' : 'hours'} {cadenceLabel[cadence]}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-ink-500">
          Hours
          <input
            type="number"
            min="0"
            step="0.5"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            onBlur={() => Number(hours) !== Number(rule.hours) && save({ hours: Number(hours) })}
            className="w-16 rounded-md border border-ink-300 bg-surface px-2 py-1 text-sm text-ink-900 outline-none focus:border-green-500"
          />
        </label>
        <select
          value={cadence}
          onChange={(e) => {
            setCadence(e.target.value)
            save({ cadence: e.target.value })
          }}
          className="rounded-md border border-ink-300 bg-surface px-2 py-1 text-sm text-ink-900 outline-none focus:border-green-500"
        >
          <option value="monthly">every month</option>
          <option value="per_event">per new event</option>
        </select>
        <button
          type="button"
          onClick={() => {
            const v = !active
            setActive(v)
            save({ active: v })
          }}
          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
            active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
          }`}
        >
          {active ? 'Active' : 'Off'}
        </button>
        {granted ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
            <Check size={13} /> Granted
          </span>
        ) : (
          <button
            type="button"
            onClick={doGrant}
            disabled={granting || !active || Number(hours) <= 0}
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            title={!active || Number(hours) <= 0 ? 'Activate the rule and set hours first' : 'Grant this month now'}
          >
            {granting ? <Loader2 size={13} className="animate-spin" /> : null} Grant Now
          </button>
        )}
        <span className={`flex items-center gap-1 text-xs font-medium text-green-700 transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}>
          <Check size={12} /> Saved
        </span>
      </div>
    </Card>
  )
}
