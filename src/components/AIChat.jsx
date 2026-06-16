import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Sparkles, Send, Loader2, CalendarDays, User, Target, MapPin, CalendarRange, PiggyBank, ExternalLink,
} from 'lucide-react'
import { Card } from './ui'
import { chatWithAI } from '../lib/api'

// Starter prompts shown on the empty state.
const SUGGESTIONS = [
  'What events are coming up?',
  'How are we doing on fundraising?',
  'Who has the most hours this term?',
  'What is Janyaa’s mission?',
]

// kind → where the citation card links + how it looks.
const refMeta = {
  event: { to: (r) => `/events/${r.id}`, icon: CalendarDays, tone: 'bg-green-50 text-green-600' },
  member: { to: (r) => `/members/${r.id}`, icon: User, tone: 'bg-blue-50 text-blue-600' },
  goal: { to: () => '/goals', icon: Target, tone: 'bg-gold-100 text-gold-700' },
  location: { to: () => '/locations', icon: MapPin, tone: 'bg-blue-50 text-blue-600' },
  term: { to: () => '/club-terms', icon: CalendarRange, tone: 'bg-blue-50 text-blue-600' },
  fundraising: { to: () => '/fundraising', icon: PiggyBank, tone: 'bg-gold-100 text-gold-700' },
}

// A cited reference — an in-app record (clickable card) or an external source.
function RefCard({ r }) {
  if (r.kind === 'source') {
    return (
      <a
        href={r.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:border-blue-300 hover:text-blue-700"
      >
        <ExternalLink size={13} className="shrink-0 text-ink-400" />
        <span className="truncate">{r.label}</span>
      </a>
    )
  }
  const meta = refMeta[r.kind]
  if (!meta) return null
  const Icon = meta.icon
  return (
    <Link
      to={meta.to(r)}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-ink-200 bg-surface px-2.5 py-1.5 text-xs transition-colors hover:border-green-300"
    >
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded ${meta.tone}`}>
        <Icon size={12} />
      </span>
      <span className="truncate font-medium text-ink-800">{r.label}</span>
      {r.sub && <span className="shrink-0 text-ink-400">· {r.sub}</span>}
    </Link>
  )
}

function Bubble({ m }) {
  const isUser = m.role === 'user'
  return (
    <div className={`ja-fade flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? '' : 'w-full'}`}>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
            isUser
              ? 'rounded-br-sm bg-green-600 text-white'
              : 'rounded-bl-sm bg-ink-100 text-ink-800'
          }`}
        >
          {m.content}
        </div>
        {m.references?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.references.map((r, i) => (
              <RefCard key={i} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Members-only assistant with live club context. Conversation lives in component
// state; we send the recent turns to the ai-chat Edge Function, which rate-limits
// per member (free Gemini tier) and returns an answer + citation cards.
export default function AIChat() {
  const [messages, setMessages] = useState([]) // {role, content, references?}
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [usage, setUsage] = useState(null) // { usedToday, dayLimit }
  const [cooldown, setCooldown] = useState(0) // seconds left after a rate limit
  const scrollRef = useRef(null)
  const taRef = useRef(null)

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  // Count down the rate-limit cooldown.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(t)
  }, [cooldown])

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || busy || cooldown > 0) return
    setError('')
    setInput('')
    const next = [...messages, { role: 'user', content }]
    setMessages(next)
    setBusy(true)
    // Send role/content only (drop the rendered references).
    const res = await chatWithAI(next.map(({ role, content }) => ({ role, content })))
    setBusy(false)

    if (res?.usage) setUsage(res.usage)
    if (res?.ok) {
      setMessages([...next, { role: 'assistant', content: res.answer || '…', references: res.references ?? [] }])
      return
    }
    // Error / rate limit — surface the message, keep the user's text in the thread.
    setError(res?.error || 'Something went wrong. Try again.')
    if (res?.rateLimited && res.retryAfterSeconds) setCooldown(res.retryAfterSeconds)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Grow the textarea with its content (1–4 lines).
  function onInput(e) {
    setInput(e.target.value)
    const ta = taRef.current
    if (ta) {
      ta.style.height = 'auto'
      ta.style.height = Math.min(ta.scrollHeight, 112) + 'px'
    }
  }

  const remaining = usage?.dayLimit != null ? Math.max(0, usage.dayLimit - (usage.usedToday ?? 0)) : null

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-h3 font-semibold text-ink-900">
          <Sparkles size={18} className="text-blue-500" /> Ask the Janyaa assistant
        </h2>
        {remaining != null && (
          <span className="text-xs text-ink-400">{remaining} message{remaining === 1 ? '' : 's'} left today</span>
        )}
      </div>

      <Card className="flex h-[28rem] flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-500">
                <Sparkles size={24} />
              </span>
              <p className="mt-3 max-w-sm text-sm text-ink-600">
                Ask about Janyaa BCP — events, hours, fundraising, members, goals — or about the Janyaa
                Foundation. Answers cite live cards you can open.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-ink-200 bg-surface px-3 py-1.5 text-xs font-medium text-ink-700 transition-colors hover:border-blue-300 hover:text-blue-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <Bubble key={i} m={m} />)
          )}

          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-ink-100 px-3.5 py-2.5 text-sm text-ink-500">
                <Loader2 size={14} className="animate-spin" /> Thinking…
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="border-t border-coral-100 bg-coral-50 px-4 py-2 text-xs text-coral-700">
            {error}
            {cooldown > 0 && ` (${cooldown}s)`}
          </p>
        )}

        <div className="flex items-end gap-2 border-t border-ink-200 p-3">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={onInput}
            onKeyDown={onKeyDown}
            placeholder={cooldown > 0 ? `Please wait ${cooldown}s…` : 'Ask about the club or Janyaa…'}
            disabled={busy || cooldown > 0}
            className="max-h-28 flex-1 resize-none rounded-lg border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 placeholder-ink-400 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:opacity-60"
          />
          <button
            onClick={() => send()}
            disabled={busy || cooldown > 0 || !input.trim()}
            aria-label="Send"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-green-600 text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-95"
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </Card>
      <p className="mt-2 text-xs text-ink-400">
        The assistant can be wrong — double-check anything important. It reads live club data each time you ask.
      </p>
    </section>
  )
}
