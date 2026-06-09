import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, Wand2, Lightbulb, MapPin, RefreshCw, Loader2, Instagram, Check, Copy, ArrowRight, CalendarPlus, Clock, TrendingUp,
} from 'lucide-react'
import { PageHeader, Card, Button, Badge, FormField, inputClass, PinButton } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import {
  getSettings, generateSuggestions, generateSocial, planEvent, createEvent, addTodo,
  getPins, addPin, removePin,
} from '../lib/api'

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

export default function AIStudio({ embedded = false }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState(null)
  const [pins, setPins] = useState([])
  const load = () => getSettings().then(setSettings)
  const loadPins = () => getPins().then(setPins)
  useEffect(() => {
    load()
    loadPins()
  }, [])

  async function pin(surface, kind, payload) {
    await addPin({ surface, kind, payload, by: user?.id })
    loadPins()
  }
  async function unpin(id) {
    await removePin(id)
    loadPins()
  }
  const pinProps = (surface) => ({ pins: pins.filter((p) => p.surface === surface), pin, unpin })

  return (
    <>
      {!embedded && (
        <PageHeader
          title="AI Studio"
          subtitle="Let AI plan events, suggest what to run next, and draft your social posts — from your real club data."
        />
      )}
      {!embedded && (
        <Card className="mb-6 overflow-hidden border-0 bg-gradient-to-r from-blue-800 to-green-800 p-6 text-white">
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <p className="text-sm font-semibold">Powered by Gemini</p>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-white/80">
            Everything here is generated from your actual events, locations, and fundraising. Review before you act —
            AI can be wrong.
          </p>
        </Card>
      )}

      <Planner />
      <Suggestions settings={settings} onChange={load} {...pinProps('suggestions')} />
      <Social settings={settings} onChange={load} {...pinProps('social')} />
    </>
  )
}

/* ------------------------------------------------------------------ Planner */

const cadenceQs = [
  { key: 'type', label: 'What kind of event?', type: 'select', options: ['Fundraiser', 'STEM education session', 'Community / outreach', 'Other'] },
  { key: 'when', label: 'When? (a date, month, or “a Saturday in July”)', type: 'text', placeholder: 'e.g. a weekend in July' },
  { key: 'time', label: 'Time of day?', type: 'select', options: ['Morning', 'Afternoon', 'Evening'] },
  { key: 'location', label: 'Where? (a place, or leave to AI)', type: 'text', placeholder: 'e.g. Evergreen Village Square' },
  { key: 'audience', label: 'Who is it for?', type: 'text', placeholder: 'e.g. families with young kids' },
  { key: 'duration', label: 'Roughly how long?', type: 'select', options: ['1 hour', '2 hours', '3 hours', '4+ hours'] },
]

function Planner() {
  const [answers, setAnswers] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState(null)
  const [created, setCreated] = useState(null)

  const set = (k) => (e) => setAnswers({ ...answers, [k]: e.target.value })

  async function generate(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setPlan(null)
    setCreated(null)
    const { data, error } = await planEvent(answers)
    setBusy(false)
    if (error || data?.ok === false || !data?.plan) {
      setError(data?.error || 'Could not draft a plan. Try again.')
      return
    }
    setPlan(data.plan)
  }

  return (
    <section className="mb-8">
      <h2 className="mb-3 flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
        <Wand2 size={18} className="text-green-600" /> Plan an event with AI
      </h2>
      <Card className="p-5">
        <p className="mb-4 text-sm text-ink-600">
          Answer what you know and leave the rest blank — AI fills in the gaps, then drafts a full plan with a
          timeline and to-dos you can create in one click.
        </p>
        <form onSubmit={generate} className="grid gap-3 sm:grid-cols-2">
          {cadenceQs.map((q) => (
            <FormField key={q.key} label={q.label}>
              {q.type === 'select' ? (
                <select className={inputClass} value={answers[q.key] ?? ''} onChange={set(q.key)}>
                  <option value="">No preference — you decide</option>
                  {q.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input className={inputClass} value={answers[q.key] ?? ''} onChange={set(q.key)} placeholder={q.placeholder} />
              )}
            </FormField>
          ))}
          <FormField label="Anything else? (goals, theme, constraints)">
            <textarea className={inputClass} rows={2} value={answers.extra ?? ''} onChange={set('extra')} placeholder="Optional" />
          </FormField>
          <div className="flex items-end">
            <Button type="submit" icon={busy ? Loader2 : Wand2} loading={busy} disabled={busy}>
              {busy ? 'Planning…' : 'Draft a plan'}
            </Button>
          </div>
        </form>
        {busy && <p className="mt-2 text-xs text-ink-400">Designing your event — this takes ~15 seconds.</p>}
        {error && <p className="mt-3 rounded-lg bg-coral-50 px-3 py-2 text-sm text-coral-700">{error}</p>}

        {plan && !created && <PlanResult plan={plan} onCreated={setCreated} onDiscard={() => setPlan(null)} />}
        {created && (
          <div className="mt-4 rounded-xl border border-green-200 bg-green-50/70 p-4">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-green-800">
              <Check size={16} /> Created “{created.name}”.
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-sm">
              <Link to={`/events/${created.id}`} className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-700">
                View event <ArrowRight size={14} />
              </Link>
              <Link to="/events" className="inline-flex items-center gap-1 font-medium text-ink-500 hover:text-ink-800">
                All events
              </Link>
              <button onClick={() => { setPlan(null); setCreated(null); setAnswers({}) }} className="font-medium text-ink-500 hover:text-ink-800">
                Plan another
              </button>
            </div>
          </div>
        )}
      </Card>
    </section>
  )
}

function PlanResult({ plan, onCreated, onDiscard }) {
  const [busy, setBusy] = useState(false)
  const timeline = Array.isArray(plan.timeline) ? plan.timeline : []
  const todos = Array.isArray(plan.todos) ? plan.todos : []

  async function createIt() {
    setBusy(true)
    const notes = [
      plan.summary,
      timeline.length ? '\nTimeline:\n' + timeline.map((t) => `${t.time ? t.time + ' - ' : ''}${t.item}`).join('\n') : '',
    ].filter(Boolean).join('\n')

    const { data: created, error } = await createEvent({
      name: plan.name,
      date: plan.date || null,
      is_tentative: !plan.date,
      start_time: plan.startTime || null,
      end_time: plan.endTime || null,
      location: plan.location || '',
      address: plan.address || '',
      hours: Number(plan.hours) || 3,
      min_people: Number(plan.minPeople) || 2,
      max_people: Number(plan.maxPeople) || 6,
      raised: 0,
      notes,
      instagram_urls: [],
      type: 'other',
    })
    if (!error && created) {
      for (const t of todos) await addTodo(created.id, t)
      setBusy(false)
      onCreated(created)
    } else {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-ink-200 bg-ink-50/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-h4 font-semibold text-ink-900">{plan.name}</h3>
        {plan.date ? <Badge tone="blue">{plan.date}</Badge> : <Badge tone="gold">Date TBD</Badge>}
        {plan.startTime && <Badge tone="ink">{plan.startTime}{plan.endTime ? `–${plan.endTime}` : ''}</Badge>}
      </div>
      {plan.location && <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-600"><MapPin size={14} className="text-ink-400" /> {plan.location}</p>}
      {plan.summary && <p className="mt-2 text-sm text-ink-600">{plan.summary}</p>}

      {timeline.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">Timeline</p>
          <ul className="space-y-1">
            {timeline.map((t, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink-700">
                <span className="shrink-0 font-mono text-xs text-green-700">{t.time || '•'}</span>
                <span>{t.item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {todos.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">To-dos ({todos.length})</p>
          <div className="flex flex-wrap gap-1.5">
            {todos.map((t, i) => (
              <span key={i} className="rounded-full bg-surface px-2.5 py-1 text-xs text-ink-700 ring-1 ring-ink-200">{t}</span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button icon={busy ? Loader2 : CalendarPlus} loading={busy} disabled={busy} onClick={createIt}>
          {busy ? 'Creating…' : 'Create this event + to-dos'}
        </Button>
        <Button variant="soft" type="button" onClick={onDiscard} disabled={busy}>Discard</Button>
      </div>
      <p className="mt-2 text-xs text-ink-400">Creates the event (tentative if no date) with the timeline in its notes and every to-do pre-added.</p>
    </div>
  )
}

/* -------------------------------------------------------------- Suggestions */

function Suggestions({ settings, onChange, pins, pin, unpin }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const sug = settings?.ai_suggestions ?? null
  const events = sug?.events ?? []
  const locations = sug?.locations ?? []
  const pinnedEvents = pins.filter((p) => p.kind === 'suggestion_event')
  const pinnedLocs = pins.filter((p) => p.kind === 'suggestion_location')
  const pinnedET = new Set(pinnedEvents.map((p) => p.payload?.title))
  const pinnedLN = new Set(pinnedLocs.map((p) => p.payload?.name))

  async function generate() {
    setBusy(true)
    setError('')
    const { data, error } = await generateSuggestions()
    setBusy(false)
    if (error || data?.ok === false) {
      const msg = data?.error || error?.message || 'Could not generate.'
      setError(msg.includes('GEMINI_API_KEY') ? 'AI is not set up yet — an admin needs to add the Gemini key.' : msg)
      return
    }
    onChange()
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
          <Lightbulb size={18} className="text-gold-500" /> What to run next
        </h2>
        <div className="flex flex-col items-end gap-1">
          <Button variant="soft" icon={busy ? Loader2 : RefreshCw} loading={busy} onClick={generate} disabled={busy}>
            {busy ? 'Thinking…' : events.length ? 'Refresh' : 'Generate'}
          </Button>
          {settings?.ai_suggestions_at && !busy && <span className="text-xs text-ink-400">Updated {timeAgo(settings.ai_suggestions_at)}</span>}
        </div>
      </div>
      {error && <Card className="mb-3 border-coral-200 bg-coral-50 p-3 text-sm text-coral-700">{error}</Card>}

      {events.length === 0 && locations.length === 0 && pins.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-500">
          Hit Generate to get event + location ideas pulled from what’s worked before.
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-800"><CalendarPlus size={15} className="text-green-600" /> Event ideas</h3>
            <ul className="space-y-3">
              {pinnedEvents.map((p) => (
                <EventIdea key={p.id} e={p.payload} pin={{ pinned: true, onToggle: () => unpin(p.id) }} />
              ))}
              {events.filter((e) => !pinnedET.has(e.title)).map((e, i) => (
                <EventIdea key={i} e={e} pin={{ pinned: false, onToggle: () => pin('suggestions', 'suggestion_event', e) }} />
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-ink-800"><MapPin size={15} className="text-blue-600" /> Locations to try</h3>
            <ul className="space-y-3">
              {pinnedLocs.map((p) => (
                <LocationIdea key={p.id} l={p.payload} pin={{ pinned: true, onToggle: () => unpin(p.id) }} />
              ))}
              {locations.filter((l) => !pinnedLN.has(l.name)).map((l, i) => (
                <LocationIdea key={i} l={l} pin={{ pinned: false, onToggle: () => pin('suggestions', 'suggestion_location', l) }} />
              ))}
            </ul>
          </Card>
        </div>
      )}
    </section>
  )
}

function EventIdea({ e, pin }) {
  return (
    <li className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-ink-900">{e.title}</p>
          {e.bestDay && <Badge tone="blue">{e.bestDay}</Badge>}
        </div>
        <PinButton pinned={pin.pinned} onClick={pin.onToggle} />
      </div>
      <p className="mt-1 text-sm text-ink-600">{e.why}</p>
      {e.expected && <p className="mt-1 text-xs font-medium text-green-700">{e.expected}</p>}
    </li>
  )
}

function LocationIdea({ l, pin }) {
  return (
    <li className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-ink-900">{l.name}</p>
        <PinButton pinned={pin.pinned} onClick={pin.onToggle} />
      </div>
      <p className="mt-1 text-sm text-ink-600">{l.why}</p>
    </li>
  )
}

/* -------------------------------------------------------------------- Social */

function Social({ settings, onChange, pins, pin, unpin }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const posts = Array.isArray(settings?.social_posts) ? settings.social_posts : []
  const pinnedIdeas = new Set(pins.map((p) => p.payload?.idea))

  async function generate() {
    setBusy(true)
    setError('')
    const { data, error } = await generateSocial(true)
    setBusy(false)
    if (error || data?.ok === false) {
      const msg = data?.error || error?.message || 'Could not generate.'
      setError(msg.includes('GEMINI_API_KEY') ? 'AI is not set up yet — an admin needs to add the Gemini key.' : msg)
      return
    }
    onChange()
  }

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
          <Instagram size={18} className="text-coral-500" /> Social media ideas
        </h2>
        <div className="flex flex-col items-end gap-1">
          <Button variant="soft" icon={busy ? Loader2 : RefreshCw} loading={busy} onClick={generate} disabled={busy}>
            {busy ? 'Researching…' : posts.length ? 'Refresh' : 'Generate'}
          </Button>
          {settings?.social_posts_at && !busy && <span className="text-xs text-ink-400">Auto-refreshes monthly · updated {timeAgo(settings.social_posts_at)}</span>}
        </div>
      </div>
      {busy && <p className="mb-3 text-xs text-ink-400">Checking current trends — this takes ~20 seconds.</p>}
      {error && <Card className="mb-3 border-coral-200 bg-coral-50 p-3 text-sm text-coral-700">{error}</Card>}

      <Card className="mb-4 flex items-start gap-2 border-gold-200 bg-gold-50/60 p-3 text-xs text-gold-800">
        <TrendingUp size={14} className="mt-0.5 shrink-0" />
        <span>Trend + audio hints are directional. There’s no public API for exact Instagram trending audio, so treat these as starting points and check what’s actually trending in the app.</span>
      </Card>

      {posts.length === 0 && pins.length === 0 ? (
        <Card className="p-6 text-center text-sm text-ink-500">Hit Generate for this month’s post ideas.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pins.map((p) => (
            <SocialCard key={p.id} post={p.payload} pin={{ pinned: true, onToggle: () => unpin(p.id) }} />
          ))}
          {posts.filter((p) => !pinnedIdeas.has(p.idea)).map((p, i) => (
            <SocialCard key={i} post={p} pin={{ pinned: false, onToggle: () => pin('social', 'social', p) }} />
          ))}
        </div>
      )}
    </section>
  )
}

function SocialCard({ post, pin }) {
  const [copied, setCopied] = useState(false)
  const hashtags = Array.isArray(post.hashtags) ? post.hashtags : []

  function copyCaption() {
    const text = [post.caption, hashtags.join(' ')].filter(Boolean).join('\n\n')
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        {post.format ? <Badge tone="blue">{post.format}</Badge> : <span />}
        <div className="flex items-center gap-1">
          {post.bestTime && <span className="flex items-center gap-1 text-2xs text-ink-400"><Clock size={11} /> {post.bestTime}</span>}
          {pin && <PinButton pinned={pin.pinned} onClick={pin.onToggle} />}
        </div>
      </div>
      <p className="mt-2 font-medium text-ink-900">{post.idea}</p>
      {post.caption && (
        <p className="mt-2 flex-1 whitespace-pre-wrap rounded-lg bg-ink-50 p-2.5 text-sm text-ink-700">{post.caption}</p>
      )}
      {hashtags.length > 0 && (
        <p className="mt-2 break-words text-xs text-blue-600">{hashtags.join(' ')}</p>
      )}
      {post.trend && (
        <p className="mt-2 flex items-start gap-1 text-2xs text-ink-500"><TrendingUp size={11} className="mt-0.5 shrink-0" /> {post.trend}</p>
      )}
      <button
        onClick={copyCaption}
        className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-ink-100 py-1.5 text-xs font-semibold text-ink-700 transition-colors hover:bg-ink-200"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy caption'}
      </button>
    </Card>
  )
}
