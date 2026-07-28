import { useEffect, useState } from 'react'
import { Sparkles, Pin } from 'lucide-react'
import { PageHeader, Card, timeAgo } from '../components/ui'
import { getSettings, getPins, addPin, removePin } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { plannedInsights } from '../data/mockData'
import InsightCard from '../components/InsightCard'

export default function Insights({ embedded = false }) {
  const { profile, user } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [settings, setSettings] = useState(null)
  const [pins, setPins] = useState([])

  const load = () => getSettings().then(setSettings)
  const loadPins = () => getPins('insights').then(setPins)
  useEffect(() => {
    load()
    loadPins()
  }, [])

  const insights = Array.isArray(settings?.ai_insights) ? settings.ai_insights : []
  const pinnedTitles = new Set(pins.map((p) => p.payload?.title))
  async function pinIns(ins) {
    await addPin({ surface: 'insights', kind: 'insight', payload: ins, by: user?.id })
    loadPins()
  }
  async function unpin(id) {
    await removePin(id)
    loadPins()
  }

  // Regeneration now lives in the AI tab's master Regenerate control; this card
  // just shows the cached insights + when they last refreshed.
  const actions = settings?.ai_insights_at ? (
    <span className="text-xs text-ink-400">Auto-refreshes monthly · updated {timeAgo(settings.ai_insights_at)}</span>
  ) : null

  return (
    <>
      {embedded ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
            <Sparkles size={18} className="text-blue-500" /> Insights
          </h2>
          {actions}
        </div>
      ) : (
        <PageHeader
          title="AI Insights"
          action={actions}
        />
      )}

      {!embedded && (
        <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-r from-blue-800 to-green-800 p-6 text-white">
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
      )}

      {pins.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-1.5 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
            <Pin size={12} /> Pinned
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pins.map((p) => (
              <InsightCard key={p.id} ins={p.payload} pin={{ pinned: true, onToggle: () => unpin(p.id) }} />
            ))}
          </div>
        </div>
      )}

      {insights.length === 0 ? (
        <Card className="p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-500">
            <Sparkles size={24} />
          </span>
          <h3 className="mt-4 font-display text-h4 font-semibold text-ink-900">No insights yet</h3>
          <p className="mt-1 text-sm text-ink-500">
            {isAdmin
              ? 'Insights generate automatically — or use Regenerate on the AI tab.'
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
        <div className="ja-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {insights.filter((i) => !pinnedTitles.has(i.title)).map((ins, i) => (
            <InsightCard key={i} ins={ins} pin={{ pinned: false, onToggle: () => pinIns(ins) }} />
          ))}
        </div>
      )}
    </>
  )
}
