import { useEffect, useState } from 'react'
import { Sparkles, RefreshCw, Lightbulb, Instagram, CalendarRange, Users, Check, Loader2, AlertCircle } from 'lucide-react'
import { PageHeader, Button, Modal } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import {
  autoRefreshMonthlyAI, generateInsights, generateSuggestions, generateSocial,
  generateTermInsights, generateMemberInsight, getMembersBrief,
} from '../lib/api'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import Insights from './Insights'
import AIStudio from './AIStudio'

// The AI surfaces the master Regenerate control can rebuild. Each maps to one
// Gemini-backed Edge Function (member insights loop one call per member).
const SURFACES = [
  { key: 'insights', label: 'Club insights', desc: 'Dashboard + AI-tab insight cards', icon: Sparkles },
  { key: 'suggestions', label: 'Event & location ideas', desc: 'Next-event + new-location suggestions', icon: Lightbulb },
  { key: 'social', label: 'Social media ideas', desc: 'Monthly Instagram content', icon: Instagram },
  { key: 'terms', label: 'Term breakdowns', desc: 'Per-term AI summaries', icon: CalendarRange },
  { key: 'members', label: 'Member insights', desc: 'One personal insight per member · slower', icon: Users },
]

// Run one surface; returns the {data,error}-shaped result. Member insights run
// sequentially (one call per member) and report progress through `onProgress`.
async function runSurface(key, onProgress) {
  if (key === 'insights') return generateInsights()
  if (key === 'suggestions') return generateSuggestions()
  if (key === 'social') return generateSocial(true)
  if (key === 'terms') return generateTermInsights(true)
  if (key === 'members') {
    const members = await getMembersBrief()
    for (let i = 0; i < members.length; i++) {
      onProgress(`${i + 1}/${members.length}`)
      await generateMemberInsight(members[i].id, true)
    }
    return { data: { ok: true } }
  }
  return { data: { ok: true } }
}

// AI Insights + AI Studio combined into one tab: the insight feed, then event
// planning + suggestions, the assistant, and social studio — all from real club
// data, stacked on a single page. Every AI block here auto-refreshes monthly;
// admins can force a rebuild of any subset from the Regenerate control.
export default function AIPlanning() {
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin
  const [regenOpen, setRegenOpen] = useState(false)
  // Bumping this remounts the insight + studio sections so they re-read the
  // freshly regenerated data without a full page reload.
  const [refreshKey, setRefreshKey] = useState(0)
  useDocumentTitle('AI Planning')

  // Monthly auto-refresh: regenerate stale (>30-day) insights + suggestions in
  // the background. Throttled by cache age, so a normal visit costs nothing.
  useEffect(() => {
    autoRefreshMonthlyAI()
  }, [])

  return (
    <>
      <PageHeader
        title="AI Planning"
        subtitle="Gemini-powered insights, planning, and content from your real club data — refreshed automatically every month."
        action={isAdmin ? <Button icon={RefreshCw} onClick={() => setRegenOpen(true)}>Regenerate</Button> : undefined}
      />
      {/* Mobile-only hero — mirrors the redesign's gradient banner. */}
      <div
        className="mb-5 rounded-[20px] p-[18px] text-white shadow-card lg:hidden"
        style={{ background: 'linear-gradient(120deg, var(--color-blue-800), var(--color-green-800))' }}
      >
        <span className="flex items-center gap-2 text-sm font-bold"><Sparkles size={17} /> Powered by Gemini</span>
        <p className="mt-2 text-[13px] leading-relaxed text-white/85">
          The Hub feeds your real attendance, hours, fundraising, and locations into Gemini to surface what’s working — refreshed monthly.
        </p>
      </div>
      {/* The whole page cascades in on load — Insights, planning, chat, social. */}
      <div className="ja-stagger" key={refreshKey}>
        {/* Match the mb-8 rhythm of the AI Studio sections below. */}
        <section className="mb-8">
          <Insights embedded />
        </section>
        <AIStudio embedded />
      </div>

      {isAdmin && (
        <RegenerateModal
          open={regenOpen}
          onClose={() => setRegenOpen(false)}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </>
  )
}

// Master regenerate: pick which AI sections to rebuild, then run them one by one
// with per-section status. Replaces the per-card Refresh buttons across the site.
function RegenerateModal({ open, onClose, onChanged }) {
  const [sel, setSel] = useState(() => new Set(SURFACES.map((s) => s.key)))
  const [status, setStatus] = useState({}) // key -> 'running' | 'done' | 'error'
  const [notes, setNotes] = useState({}) // key -> progress text (e.g. members "3/11")
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)

  // Start fresh each time the dialog opens.
  useEffect(() => {
    if (open) {
      setSel(new Set(SURFACES.map((s) => s.key)))
      setStatus({})
      setNotes({})
      setRunning(false)
      setDone(false)
    }
  }, [open])

  const toggle = (k) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  async function run() {
    setRunning(true)
    setDone(false)
    setStatus({})
    setNotes({})
    let changed = false
    for (const s of SURFACES) {
      if (!sel.has(s.key)) continue
      setStatus((st) => ({ ...st, [s.key]: 'running' }))
      try {
        const res = await runSurface(s.key, (txt) => setNotes((n) => ({ ...n, [s.key]: txt })))
        const failed = res?.error || res?.data?.ok === false
        setStatus((st) => ({ ...st, [s.key]: failed ? 'error' : 'done' }))
        if (!failed) changed = true
      } catch {
        setStatus((st) => ({ ...st, [s.key]: 'error' }))
      }
    }
    setRunning(false)
    setDone(true)
    if (changed) onChanged()
  }

  return (
    <Modal open={open} onClose={running ? () => {} : onClose} title="Regenerate AI">
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          Pick which AI sections to rebuild from the latest club data. Gemini runs each one, so this can take a bit.
        </p>

        <div className="space-y-2">
          {SURFACES.map((s) => {
            const st = status[s.key]
            const Icon = s.icon
            return (
              <label
                key={s.key}
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink-200 bg-surface px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  checked={sel.has(s.key)}
                  onChange={() => toggle(s.key)}
                  disabled={running}
                  className="h-4 w-4 shrink-0 accent-green-600"
                />
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-ink-50 text-ink-500">
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink-800">{s.label}</span>
                  <span className="block text-xs text-ink-500">{s.desc}</span>
                </span>
                <span className="shrink-0">
                  {st === 'running' && (
                    <span className="flex items-center gap-1 text-xs text-ink-400">
                      <Loader2 size={14} className="animate-spin" /> {notes[s.key] || ''}
                    </span>
                  )}
                  {st === 'done' && <Check size={16} className="text-green-600" />}
                  {st === 'error' && <AlertCircle size={16} className="text-coral-600" />}
                </span>
              </label>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          {done && !running ? (
            <span className="text-xs text-green-700">Done — the page updated below.</span>
          ) : (
            <span className="text-xs text-ink-400">{running ? 'Working through the list…' : `${sel.size} selected`}</span>
          )}
          <div className="flex gap-2">
            <Button variant="soft" type="button" onClick={onClose} disabled={running}>
              {done ? 'Close' : 'Cancel'}
            </Button>
            <Button type="button" icon={running ? Loader2 : RefreshCw} loading={running} onClick={run} disabled={running || sel.size === 0}>
              {running ? 'Regenerating…' : `Regenerate (${sel.size})`}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
