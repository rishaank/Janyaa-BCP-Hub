import { useEffect, useState } from 'react'
import { Clock, Info, RefreshCw, Check } from 'lucide-react'
import { PageHeader, Card, Button, Badge, EditAccessChip, roleLabels } from '../components/ui'
import { getRoleHoursRules, updateRoleHoursRule, ensureMonthlyRoleHours } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../lib/useRealtime'

const cadenceLabel = { monthly: 'every month', per_event: 'per new event' }
// Stable display order, regardless of how the rows come back.
const ORDER = ['operations_lead', 'event_lead', 'pr_lead', 'outreach_lead', 'secretary', 'education_lead']

export default function AutoHours() {
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState('')

  const load = () =>
    getRoleHoursRules().then((d) => {
      setRules(d)
      setLoading(false)
    })

  useEffect(() => {
    load()
  }, [])
  useRealtime(['role_hours_rules'], load)

  async function runMonthly() {
    setRunning('running')
    const { error } = await ensureMonthlyRoleHours()
    setRunning(error ? 'error' : 'done')
    setTimeout(() => setRunning(''), 2500)
  }

  const ordered = [...rules].sort((a, b) => ORDER.indexOf(a.role) - ORDER.indexOf(b.role))

  return (
    <>
      <PageHeader
        title="Auto hours"
        subtitle="Volunteer hours that accrue automatically based on a member's role."
        action={
          isAdmin && (
            <div className="flex items-center gap-3">
              <EditAccessChip />
              <Button
                variant="soft"
                icon={RefreshCw}
                loading={running === 'running'}
                onClick={runMonthly}
                disabled={running === 'running'}
              >
                {running === 'running'
                  ? 'Granting…'
                  : running === 'done'
                    ? 'Granted'
                    : running === 'error'
                      ? 'Failed'
                      : 'Grant this month'}
              </Button>
            </div>
          )
        }
      />

      <Card className="mb-6 flex items-start gap-3 border-blue-200 bg-blue-50/60 p-4 text-sm text-ink-700">
        <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
        <div className="space-y-1">
          <p><span className="font-semibold">How it works.</span> These hours are added automatically, on top of event sign-ups.</p>
          <ul className="list-disc space-y-0.5 pl-5 text-ink-600">
            <li><span className="font-medium text-ink-800">Every month</span> grants on the 1st (admins can top up the current month with the button above).</li>
            <li><span className="font-medium text-ink-800">Per new event</span> grants the moment an event is created.</li>
            <li>Auto-hours accrue going forward — set each member’s accurate hours so far from their profile.</li>
          </ul>
        </div>
      </Card>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-[68px] animate-pulse bg-ink-50" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {ordered.map((rule) => (
            <RuleRow key={rule.role} rule={rule} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      {!isAdmin && (
        <p className="mt-4 text-xs text-ink-400">Only admins can change these rules.</p>
      )}
    </>
  )
}

function RuleRow({ rule, isAdmin }) {
  const [hours, setHours] = useState(rule.hours)
  const [cadence, setCadence] = useState(rule.cadence)
  const [active, setActive] = useState(rule.active)
  const [saved, setSaved] = useState(false)

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

  return (
    <Card className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${!active ? 'opacity-60' : ''}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500">
          <Clock size={17} />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-ink-900">{roleLabels[rule.role] ?? rule.role}</p>
          <p className="text-xs text-ink-500">
            {Number(hours)} {Number(hours) === 1 ? 'hour' : 'hours'} {cadenceLabel[cadence]}
          </p>
        </div>
      </div>

      {isAdmin ? (
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
          <span className={`flex items-center gap-1 text-xs font-medium text-green-700 transition-opacity ${saved ? 'opacity-100' : 'opacity-0'}`}>
            <Check size={12} /> Saved
          </span>
        </div>
      ) : (
        <Badge tone={active ? 'green' : 'ink'}>{active ? 'Active' : 'Off'}</Badge>
      )}
    </Card>
  )
}
