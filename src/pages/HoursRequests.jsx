import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Clock, Lock } from 'lucide-react'
import { PageHeader, Card, Button, Badge, Avatar, EmptyState, inputClass, roleTones } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { getHoursRequests, decideHoursRequest, initials } from '../lib/api'
import { useRealtime } from '../lib/useRealtime'

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

// Operations-lead review queue for member hours requests (migration 0023).
export default function HoursRequests() {
  const { profile } = useAuth()
  const isOpsLead = profile?.role === 'operations_lead'
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () =>
    getHoursRequests().then((d) => {
      setRequests(d)
      setLoading(false)
    })
  useEffect(() => {
    load()
  }, [])
  useRealtime(['hours_requests'], load)

  if (!isOpsLead) {
    return (
      <>
        <PageHeader title="Hours Requests" subtitle="Review members' requests for volunteer hours." />
        <EmptyState icon={Lock} title="Operations lead only">
          Only the operations lead can review hours requests.
        </EmptyState>
      </>
    )
  }

  const pending = requests.filter((r) => r.status === 'pending')
  const reviewed = requests.filter((r) => r.status !== 'pending')

  return (
    <>
      <PageHeader
        title="Hours Requests"
        subtitle="Members' requests for volunteer hours — approve to credit them, or deny with a reason."
      />
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i} className="h-40 animate-pulse bg-ink-50" />
          ))}
        </div>
      ) : (
        <>
          <Section title="Pending" count={pending.length}>
            {pending.map((r) => (
              <RequestCard key={r.id} req={r} onChange={load} />
            ))}
          </Section>
          <Section title="Reviewed" count={reviewed.length}>
            {reviewed.map((r) => (
              <RequestCard key={r.id} req={r} onChange={load} reviewed />
            ))}
          </Section>
        </>
      )}
    </>
  )
}

function Section({ title, count, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
        {title} · {count}
      </h2>
      {count === 0 ? (
        <p className="text-sm text-ink-400">Nothing here.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">{children}</div>
      )}
    </section>
  )
}

function RequestCard({ req, onChange, reviewed }) {
  const [denying, setDenying] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const r = req.requester

  async function approve() {
    setBusy('approve')
    setErr('')
    const { error } = await decideHoursRequest(req.id, true)
    setBusy('')
    if (error) return setErr(error.message || 'Could not approve the request.')
    onChange()
  }
  async function deny() {
    if (!reason.trim()) return setErr('A reason is required to deny.')
    setBusy('deny')
    setErr('')
    const { error } = await decideHoursRequest(req.id, false, reason.trim())
    setBusy('')
    if (error) return setErr(error.message || 'Could not deny the request.')
    onChange()
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-display text-h4 font-semibold text-ink-900">{req.activity}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-500">
            {r && (
              <Link to={`/members/${r.id}`} className="flex items-center gap-1.5 transition-colors hover:text-green-700">
                <Avatar size="xs" initials={initials(r.name)} tone={roleTones[r.role]} src={r.avatar_url} />
                {r.name}
              </Link>
            )}
            <span className="flex items-center gap-1">
              <Clock size={13} className="text-ink-400" /> {fmtDateTime(req.created_at)}
            </span>
          </div>
        </div>
        <span className="shrink-0 rounded-xl bg-ink-50 px-3 py-1.5 text-center">
          <span className="block font-display text-lg font-bold leading-none text-ink-900">{Number(req.hours)}</span>
          <span className="mt-0.5 block text-2xs text-ink-500">hours</span>
        </span>
      </div>

      {req.contribution && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{req.contribution}</p>
      )}

      {reviewed ? (
        <div className="mt-4">
          {req.status === 'approved' ? (
            <Badge tone="green"><Check size={11} /> Approved{req.reviewer?.name ? ` by ${req.reviewer.name}` : ''}</Badge>
          ) : (
            <div>
              <Badge tone="coral"><X size={11} /> Denied{req.reviewer?.name ? ` by ${req.reviewer.name}` : ''}</Badge>
              {req.denial_reason && (
                <p className="mt-2 text-sm text-ink-600">
                  <span className="font-medium text-ink-700">Reason:</span> {req.denial_reason}
                </p>
              )}
            </div>
          )}
        </div>
      ) : denying ? (
        <div className="mt-4 space-y-2">
          <textarea
            className={inputClass}
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you denying this? (required)"
          />
          {err && <p className="text-xs text-coral-700">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button
              variant="soft"
              type="button"
              onClick={() => {
                setDenying(false)
                setReason('')
                setErr('')
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" type="button" onClick={deny} disabled={busy === 'deny'}>
              {busy === 'deny' ? 'Denying…' : 'Confirm deny'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="grid grid-cols-2 gap-2">
            <Button icon={Check} onClick={approve} disabled={busy === 'approve'}>
              {busy === 'approve' ? 'Approving…' : 'Approve'}
            </Button>
            <Button variant="danger" icon={X} onClick={() => setDenying(true)}>Deny</Button>
          </div>
          {err && <p className="mt-2 text-xs text-coral-700">{err}</p>}
        </div>
      )}
    </Card>
  )
}
