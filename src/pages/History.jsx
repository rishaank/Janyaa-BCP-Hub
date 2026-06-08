import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  History as HistoryIcon,
  GitCommit,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  Hand,
  Check,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import { PageHeader, Card, Badge, EmptyState } from '../components/ui'
import { getActivityLog } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../lib/useRealtime'
import { useGithubCommits } from '../lib/useGithubCommits'

// action → icon + colour
const ICONS = {
  created: { Icon: Plus, tone: 'text-green-600 bg-green-50' },
  updated: { Icon: Pencil, tone: 'text-blue-600 bg-blue-50' },
  deleted: { Icon: Trash2, tone: 'text-coral-600 bg-coral-50' },
  signed_up: { Icon: UserPlus, tone: 'text-green-600 bg-green-50' },
  left: { Icon: UserMinus, tone: 'text-ink-500 bg-ink-100' },
  claimed: { Icon: Hand, tone: 'text-green-600 bg-green-50' },
  unclaimed: { Icon: Hand, tone: 'text-ink-500 bg-ink-100' },
  brought: { Icon: Check, tone: 'text-green-600 bg-green-50' },
  joined: { Icon: Sparkles, tone: 'text-gold-700 bg-gold-100' },
}

const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const fmtDay = (d) => {
  const today = new Date().toDateString()
  const yest = new Date(Date.now() - 864e5).toDateString()
  if (d.toDateString() === today) return 'Today'
  if (d.toDateString() === yest) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
}

export default function History() {
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const { commits } = useGithubCommits(30)

  const load = () =>
    getActivityLog(150).then((data) => {
      setRows(data)
      setLoading(false)
    })

  useEffect(() => {
    if (isAdmin) load()
    else setLoading(false)
  }, [isAdmin])
  useRealtime(['activity_log'], load)

  if (!isAdmin) {
    return (
      <>
        <PageHeader title="History" />
        <EmptyState icon={HistoryIcon} title="Admins only">
          The activity history is visible to club admins.
        </EmptyState>
      </>
    )
  }

  // Merge the DB audit trail with GitHub commits into one timeline.
  const items = [
    ...rows.map((r) => ({ key: `a${r.id}`, when: new Date(r.created_at), type: 'activity', ...r })),
    ...commits.map((c) => ({ key: `c${c.sha}`, when: new Date(c.date), type: 'update', message: c.message, url: c.url })),
  ].sort((a, b) => b.when - a.when)

  const groups = []
  for (const it of items) {
    const k = it.when.toDateString()
    let g = groups.find((x) => x.k === k)
    if (!g) {
      g = { k, label: fmtDay(it.when), items: [] }
      groups.push(g)
    }
    g.items.push(it)
  }

  return (
    <>
      <PageHeader
        title="History"
        subtitle="Every action across the Hub, plus website updates."
        badge={{ tone: 'blue', label: 'Admin' }}
      />
      {loading ? (
        <Card className="p-6 text-sm text-ink-500">Loading…</Card>
      ) : items.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="Nothing yet">
          Actions will show up here as members use the Hub.
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <div key={g.k}>
              <h2 className="mb-2 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">{g.label}</h2>
              <Card className="divide-y divide-ink-100">
                {g.items.map((it) => (it.type === 'update' ? <UpdateRow key={it.key} it={it} /> : <ActivityRow key={it.key} it={it} />))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function ActivityRow({ it }) {
  const { Icon, tone } = ICONS[it.action] ?? { Icon: Pencil, tone: 'text-ink-500 bg-ink-100' }
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${tone}`}>
        <Icon size={14} />
      </span>
      <p className="min-w-0 flex-1 text-sm text-ink-700">
        {it.action === 'joined' ? (
          <>
            New member added:{' '}
            {it.actor_id ? (
              <Link to={`/members/${it.actor_id}`} className="font-semibold text-ink-900 hover:text-blue-700">{it.actor_name}</Link>
            ) : (
              <span className="font-semibold text-ink-900">{it.actor_name}</span>
            )}
          </>
        ) : (
          <>
            {it.actor_id ? (
              <Link to={`/members/${it.actor_id}`} className="font-semibold text-ink-900 hover:text-blue-700">{it.actor_name}</Link>
            ) : (
              <span className="font-semibold text-ink-900">{it.actor_name}</span>
            )}{' '}
            {it.summary}
          </>
        )}
      </p>
      <span className="shrink-0 font-mono text-xs text-ink-400">{fmtTime(it.when)}</span>
    </div>
  )
}

function UpdateRow({ it }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-50 text-blue-600">
        <GitCommit size={14} />
      </span>
      <a
        href={it.url}
        target="_blank"
        rel="noreferrer"
        className="group flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-700"
      >
        <Badge tone="blue">Website update</Badge>
        <span className="truncate group-hover:text-blue-700">{it.message}</span>
        <ExternalLink size={12} className="shrink-0 text-ink-400" />
      </a>
      <span className="shrink-0 font-mono text-xs text-ink-400">{fmtTime(it.when)}</span>
    </div>
  )
}
