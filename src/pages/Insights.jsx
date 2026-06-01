import { useEffect, useState } from 'react'
import { Sparkles, TrendingUp, AlertTriangle, Info, RefreshCw, Loader2 } from 'lucide-react'
import { PageHeader, Card, Badge, Button } from '../components/ui'
import { getSettings, generateInsights } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { plannedInsights } from '../data/mockData'

const toneMeta = {
  positive: { icon: TrendingUp, chip: 'green', iconBg: 'bg-green-50 text-green-600' },
  warning: { icon: AlertTriangle, chip: 'gold', iconBg: 'bg-gold-100 text-gold-700' },
  neutral: { icon: Info, chip: 'blue', iconBg: 'bg-blue-50 text-blue-600' },
}

function timeAgo(iso) {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function Insights() {
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [settings, setSettings] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = () => getSettings().then(setSettings)
  useEffect(() => {
    load()
  }, [])

  const insights = Array.isArray(settings?.ai_insights) ? settings.ai_insights : []

  async function generate() {
    setBusy(true)
    setError('')
    const { data, error } = await generateInsights()
    setBusy(false)
    if (error || data?.ok === false) {
      const msg = data?.error || error?.message || 'Could not generate insights.'
      setError(msg.includes('GEMINI_API_KEY') ? 'not_configured' : msg)
      return
    }
    await load()
  }

  return (
    <>
      <PageHeader
        title="AI Insights"
        subtitle="Specific, actionable patterns pulled from your real events, hours, and fundraising."
        action={
          isAdmin ? (
            <div className="flex flex-col items-end gap-1">
              <Button icon={busy ? Loader2 : RefreshCw} onClick={generate} disabled={busy}>
                {busy ? 'Analyzing…' : insights.length ? 'Regenerate' : 'Generate'}
              </Button>
              {settings?.ai_insights_at && (
                <span className="text-xs text-ink-400">Updated {timeAgo(settings.ai_insights_at)}</span>
              )}
            </div>
          ) : settings?.ai_insights_at ? (
            <span className="text-xs text-ink-400">Updated {timeAgo(settings.ai_insights_at)} · auto-refreshes on changes</span>
          ) : null
        }
      />

      {error === 'not_configured' ? (
        <Card className="mb-6 border-gold-200 bg-gold-50/70 p-4 text-sm text-gold-800">
          Not set up yet — an admin needs to add the <span className="font-mono">GEMINI_API_KEY</span> in Supabase before insights can generate.
        </Card>
      ) : error ? (
        <Card className="mb-6 border-coral-200 bg-coral-50 p-4 text-sm text-coral-700">{error}</Card>
      ) : null}

      <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-r from-blue-700 to-green-700 p-6 text-white">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <p className="text-sm font-semibold">Powered by Gemini</p>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-white/80">
          The Hub feeds your real attendance, hours, fundraising, and locations into Gemini to surface what's
          working and what needs attention.
          {settings?.ai_insights_at && ` Last generated ${timeAgo(settings.ai_insights_at)}.`}
        </p>
      </Card>

      {insights.length === 0 ? (
        <Card className="p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-500">
            <Sparkles size={24} />
          </span>
          <h3 className="mt-4 font-display text-h4 font-semibold text-ink-900">No insights yet</h3>
          <p className="mt-1 text-sm text-ink-500">
            {isAdmin
              ? 'Hit Generate to analyze the club’s data.'
              : 'Insights generate automatically as the club logs events and fundraising.'}{' '}
            Gemini will look for things like:
          </p>
          <ul className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm text-ink-600">
            {plannedInsights.map((t, i) => (
              <li key={i} className="flex gap-2">
                <Sparkles size={14} className="mt-0.5 shrink-0 text-blue-400" /> {t}
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {insights.map((ins, i) => {
            const meta = toneMeta[ins.tone] ?? toneMeta.neutral
            const Icon = meta.icon
            return (
              <Card key={i} className="flex flex-col p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`grid h-10 w-10 place-items-center rounded-md ${meta.iconBg}`}>
                    <Icon size={20} />
                  </span>
                  {ins.metric && <Badge tone={meta.chip}>{ins.metric}</Badge>}
                </div>
                <h3 className="mt-3 font-display text-h4 font-semibold text-ink-900">{ins.title}</h3>
                <p className="mt-1.5 flex-1 text-sm text-ink-600">{ins.detail}</p>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
