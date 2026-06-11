import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarRange, CalendarDays, CalendarCheck, Users, DollarSign, ChevronDown,
  Sparkles, Loader2, Pencil, Trash2, Plus,
} from 'lucide-react'
import {
  PageHeader, Card, Button, Badge, Avatar, Modal, FormField, inputClass,
  formatDate, timeAgo, roleTones, EditAccessChip,
} from '../components/ui'
import { toneMeta } from '../components/InsightCard'
import { useAuth } from '../context/AuthContext'
import { useRealtime } from '../lib/useRealtime'
import {
  getTerms, getTermActivity, getSettings, createTerm, updateTerm, deleteTerm,
  setAutoTerming, generateTermInsights, initials,
} from '../lib/api'

const TODAY = new Date().toISOString().slice(0, 10)

// Every club term — what happened, who took part, and what it earned — with a
// per-term AI breakdown. Terms auto-materialize seasonally (ensure_terms);
// admins can edit/add terms and turn auto-terming off.
export default function ClubTerms() {
  const { profile } = useAuth()
  const isAdmin = !!profile?.is_admin

  const [terms, setTerms] = useState(null)
  const [activity, setActivity] = useState({ events: [], meetings: [], members: [] })
  const [settings, setSettings] = useState(null)
  // undefined = not initialized yet (open the current term on first load);
  // null = the user collapsed everything — don't re-open on live reloads.
  const [expanded, setExpanded] = useState(undefined)
  const [modal, setModal] = useState(null) // 'new' | a term row
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')

  const load = () =>
    Promise.all([getTerms(), getTermActivity(), getSettings()]).then(([t, a, s]) => {
      setTerms(t)
      setActivity(a)
      setSettings(s)
      setExpanded((cur) =>
        cur === undefined ? t.find((x) => x.start_date <= TODAY && x.end_date >= TODAY)?.id ?? null : cur,
      )
    })

  useEffect(() => {
    load().then(() => {
      // Fill in any missing/stale AI breakdowns in the background ("as usual").
      generateTermInsights(false).then(({ data }) => {
        if (data?.ok && data.updated > 0) getTerms().then(setTerms)
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useRealtime(['terms', 'events', 'meetings', 'club_settings'], load)

  async function refreshAI() {
    setAiBusy(true)
    setAiError('')
    const { data, error } = await generateTermInsights(true)
    setAiBusy(false)
    if (error || data?.ok === false) {
      const msg = data?.error || error?.message || 'Could not refresh the AI breakdowns.'
      setAiError(msg.includes('GEMINI_API_KEY') ? 'AI is not set up yet — an admin needs to add the Gemini key.' : msg)
      return
    }
    getTerms().then(setTerms)
  }

  // Bucket events / meetings / participants into each term.
  const membersById = useMemo(() => new Map(activity.members.map((m) => [m.id, m])), [activity.members])
  const rows = useMemo(
    () =>
      (terms ?? []).map((t) => {
        const events = activity.events
          .filter((e) => e.date && !e.is_tentative && e.date >= t.start_date && e.date <= t.end_date)
          .sort((a, b) => a.date.localeCompare(b.date))
        const meetings = activity.meetings
          .filter((m) => m.date >= t.start_date && m.date <= t.end_date && !m.canceled)
          .sort((a, b) => a.date.localeCompare(b.date))
        const ids = new Set()
        for (const e of events) for (const s of e.event_signups ?? []) ids.add(s.member_id)
        for (const m of meetings) for (const a of m.meeting_attendees ?? []) ids.add(a.member_id)
        return {
          term: t,
          events,
          meetings,
          members: [...ids].map((id) => membersById.get(id)).filter(Boolean),
          profit: events.reduce((s, e) => s + Number(e.raised || 0), 0),
          current: t.start_date <= TODAY && t.end_date >= TODAY,
        }
      }),
    [terms, activity, membersById],
  )

  return (
    <>
      <PageHeader
        title="Terms"
        subtitle="Every club term — events, meetings, members, and money — with an AI breakdown of each."
        action={
          isAdmin ? (
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2">
                <Button variant="soft" icon={aiBusy ? Loader2 : Sparkles} loading={aiBusy} onClick={refreshAI} disabled={aiBusy}>
                  {aiBusy ? 'Analyzing…' : 'Refresh AI'}
                </Button>
                <Button icon={Plus} onClick={() => setModal('new')}>Add term</Button>
              </div>
              {aiBusy && <span className="text-xs text-ink-400">Summarizing every term — ~15 seconds.</span>}
            </div>
          ) : null
        }
      />

      {aiError && <Card className="mb-4 border-coral-200 bg-coral-50 p-3 text-sm text-coral-700">{aiError}</Card>}

      {isAdmin && settings && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              Auto terming <EditAccessChip />
            </p>
            <p className="mt-0.5 text-xs text-ink-500">
              Creates the seasonal terms (Winter · Spring · Summer · Fall) automatically. Turn off to manage terms by hand.
            </p>
          </div>
          <Switch
            checked={!!settings.auto_terming}
            label="Auto terming"
            onChange={async (on) => {
              await setAutoTerming(on)
              load()
            }}
          />
        </Card>
      )}

      {terms === null ? (
        <Card className="p-6 text-sm text-ink-500">Loading terms…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-500">
          No terms yet{isAdmin ? ' — add one, or turn auto terming on.' : '.'}
        </Card>
      ) : (
        <div className="ja-stagger space-y-4">
          {rows.map((r) => (
            <TermCard
              key={r.term.id}
              {...r}
              open={expanded === r.term.id}
              onToggle={() => setExpanded(expanded === r.term.id ? null : r.term.id)}
              isAdmin={isAdmin}
              autoTerming={!!settings?.auto_terming}
              onEdit={() => setModal(r.term)}
              onChanged={load}
            />
          ))}
        </div>
      )}

      <TermModal
        open={modal !== null}
        term={modal === 'new' ? null : modal}
        onClose={() => setModal(null)}
        onSaved={() => {
          setModal(null)
          load()
        }}
      />
    </>
  )
}

// One term: a header row that expands into the full breakdown.
function TermCard({ term: t, events, meetings, members, profit, current, open, onToggle, isAdmin, autoTerming, onEdit, onChanged }) {
  const ai = t.ai_summary
  const meta = toneMeta[ai?.tone] ?? toneMeta.neutral
  const Icon = meta.icon

  async function remove() {
    const note = t.source === 'auto' && autoTerming ? '\n\nAuto terming is on, so the seasonal term may be recreated.' : ''
    if (!window.confirm(`Delete the "${t.label}" term?${note}`)) return
    await deleteTerm(t.id)
    onChanged()
  }

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-ink-50/60"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
          <CalendarRange size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-h4 font-semibold text-ink-900">{t.label}</span>
            {current && <Badge tone="green">Current</Badge>}
            {t.source === 'manual' && <Badge tone="ink">Custom</Badge>}
          </span>
          <span className="mt-0.5 block text-sm text-ink-500">
            {formatDate(t.start_date)} – {formatDate(t.end_date)}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-4 text-sm text-ink-600 sm:flex">
          <span className="flex items-center gap-1.5"><CalendarDays size={15} className="text-ink-400" /> {events.length}</span>
          <span className="flex items-center gap-1.5"><CalendarCheck size={15} className="text-ink-400" /> {meetings.length}</span>
          <span className="flex items-center gap-1.5"><Users size={15} className="text-ink-400" /> {members.length}</span>
          <span className="flex items-center gap-1.5 font-semibold tabular-nums text-ink-800">
            <DollarSign size={15} className="text-gold-600" /> {profit.toLocaleString()}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className={`ja-collapse grid ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 border-t border-ink-100 p-5">
            {/* AI breakdown */}
            {ai?.summary && (
              <div className="flex items-start gap-3 rounded-xl bg-ink-50/60 p-4">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md ${meta.iconBg}`}>
                  <Icon size={18} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {ai.metric && <Badge tone={meta.chip}>{ai.metric}</Badge>}
                    <span className="flex items-center gap-1 text-2xs text-ink-400">
                      <Sparkles size={11} /> AI · updated {timeAgo(t.ai_summary_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-700">{ai.summary}</p>
                </div>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Events */}
              <div>
                <p className="mb-2 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                  Events · {events.length}
                </p>
                {events.length === 0 ? (
                  <p className="text-sm text-ink-400">No events this term.</p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {events.map((e) => (
                      <li key={e.id}>
                        <Link to={`/events/${e.id}`} className="group flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink-800 transition-colors group-hover:text-green-700">{e.name}</span>
                            <span className="block text-xs text-ink-400">{formatDate(e.date)}</span>
                          </span>
                          {Number(e.raised) > 0 && (
                            <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-gold-700">${Number(e.raised)}</span>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Meetings */}
              <div>
                <p className="mb-2 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                  Meetings · {meetings.length}
                </p>
                {meetings.length === 0 ? (
                  <p className="text-sm text-ink-400">No meetings this term.</p>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {meetings.map((m) => (
                      <li key={m.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink-800">{m.title}</span>
                          <span className="block text-xs text-ink-400">{formatDate(m.date)}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-600">
                          {(m.meeting_attendees ?? []).length} in
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Participants */}
              <div>
                <p className="mb-2 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
                  Participated · {members.length}
                </p>
                {members.length === 0 ? (
                  <p className="text-sm text-ink-400">No participation logged.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {members.map((m) => (
                      <li key={m.id}>
                        <Link to={`/members/${m.id}`} className="group flex items-center gap-2">
                          <Avatar size="sm" initials={initials(m.name)} tone={roleTones[m.role] ?? 'blue'} src={m.avatar_url} />
                          <span className="truncate text-sm text-ink-700 transition-colors group-hover:text-green-700">{m.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 border-t border-ink-100 pt-3">
                <Button variant="soft" icon={Pencil} onClick={onEdit}>Edit term</Button>
                {(t.source === 'manual' || !autoTerming) && (
                  <Button variant="danger" icon={Trash2} onClick={remove}>Delete</Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

// Admin add/edit form for a term. Edited terms become 'manual' so auto terming
// never overwrites them.
function TermModal({ open, term, onClose, onSaved }) {
  const editing = Boolean(term)
  const [label, setLabel] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (open) {
      setLabel(term?.label ?? '')
      setStart(term?.start_date ?? '')
      setEnd(term?.end_date ?? '')
      setErr('')
    }
  }, [open, term])

  async function submit(e) {
    e.preventDefault()
    if (end < start) return setErr('The end date must be on or after the start date.')
    setBusy(true)
    setErr('')
    const fields = { label: label.trim(), start_date: start, end_date: end }
    const { error } = editing ? await updateTerm(term.id, fields) : await createTerm(fields)
    setBusy(false)
    if (error) return setErr(error.message)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${term?.label ?? 'term'}` : 'Add term'}>
      <form onSubmit={submit} className="space-y-3">
        <FormField label="Label">
          <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="e.g. Summer 2026" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Starts">
            <input type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} required />
          </FormField>
          <FormField label="Ends">
            <input type="date" className={inputClass} value={end} onChange={(e) => setEnd(e.target.value)} required />
          </FormField>
        </div>
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          The current term drives “this term” hours on the dashboard and profiles, so date changes apply everywhere.
        </p>
        {err && <p className="text-sm text-coral-700">{err}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="soft" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add term'}</Button>
        </div>
      </form>
    </Modal>
  )
}

// On/off switch styled to the brand (used for the auto-terming setting).
function Switch({ checked, onChange, label }) {
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await onChange(!checked)
        setBusy(false)
      }}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        checked ? 'bg-green-600' : 'bg-ink-300'
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-xs transition-[left] ${
          checked ? 'left-6' : 'left-1'
        }`}
      />
    </button>
  )
}
