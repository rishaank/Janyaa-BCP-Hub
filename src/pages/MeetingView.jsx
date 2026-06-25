import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Share2, Check, MapPin, Clock, Hourglass, Users, CalendarDays, Link2 } from 'lucide-react'
import { Logo, Avatar, Badge, roleTones } from '../components/ui'
import { getPublicMeeting, initials } from '../lib/api'
import Linkify from '../components/Linkify'
import LinkChip from '../components/LinkChip'

const fmtTime = (t) => {
  if (!t) return ''
  const [h, m] = t.split(':')
  return new Date(2000, 0, 1, Number(h), Number(m)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}
const fmtDate = (iso) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

// Meeting length in hours (default 1 if untimed). Attendees earn this; contributors +1.
function meetingLength(m) {
  if (m.start_time && m.end_time) {
    const [sh, sm] = m.start_time.split(':').map(Number)
    const [eh, em] = m.end_time.split(':').map(Number)
    const d = (eh * 60 + em - (sh * 60 + sm)) / 60
    if (d > 0) return Math.round(d * 10) / 10
  }
  return 1
}

export default function MeetingView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [meeting, setMeeting] = useState(undefined) // undefined = loading, null = not found
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getPublicMeeting(id).then(setMeeting)
  }, [id])

  async function share() {
    const url = window.location.href
    // Native share sheet on mobile (and any browser that supports it); fall
    // back to copying the link on desktop / unsupported browsers.
    if (navigator.share) {
      try {
        await navigator.share({ title: meeting?.title || 'Janyaa BCP meeting', url })
        return
      } catch (err) {
        if (err?.name === 'AbortError') return // user dismissed the sheet
        // otherwise fall through to clipboard
      }
    }
    navigator.clipboard?.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/'))

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-[500] border-b border-ink-200 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link to="/" aria-label="Janyaa BCP Hub"><Logo /></Link>
          <button onClick={goBack} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800">
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {meeting === undefined ? (
          <div className="space-y-4">
            <div className="h-8 w-2/3 animate-pulse rounded-md bg-ink-100" />
            <div className="h-64 w-full animate-pulse rounded-xl bg-ink-100" />
          </div>
        ) : meeting === null ? (
          <div className="py-24 text-center">
            <h1 className="font-display text-h2 font-bold text-ink-900">Meeting not found</h1>
            <p className="mt-2 text-sm text-ink-500">This meeting may have been removed.</p>
            <Link to="/" className="mt-4 inline-block text-sm font-medium text-blue-600 hover:text-blue-700">← Back to the dashboard</Link>
          </div>
        ) : (
          <MeetingBody meeting={meeting} copied={copied} onShare={share} />
        )}
      </main>
    </div>
  )
}

function MeetingBody({ meeting, copied, onShare }) {
  const attendees = meeting.attendees ?? []
  const links = meeting.links ?? []
  const timeRange = meeting.start_time
    ? (meeting.end_time ? `${fmtTime(meeting.start_time)}–${fmtTime(meeting.end_time)}` : fmtTime(meeting.start_time)) + ' PST'
    : ''
  const len = meetingLength(meeting)

  return (
    <>
      {/* Hero */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className={`break-words font-display text-h1 font-bold tracking-tight text-ink-900 ${meeting.canceled ? 'line-through' : ''}`}>
              {meeting.title}
            </h1>
            {meeting.series_id && <Badge tone="blue">Weekly</Badge>}
            {meeting.canceled && <Badge tone="coral">Canceled</Badge>}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={15} className="text-ink-400" /> {fmtDate(meeting.date)}
            </span>
            {timeRange && (
              <span className="flex items-center gap-1.5"><Clock size={15} className="text-ink-400" /> {timeRange}</span>
            )}
            {meeting.location && (
              <span className="flex min-w-0 max-w-full items-center gap-1.5">
                <MapPin size={15} className="shrink-0 text-ink-400" />
                <span className="min-w-0 break-words"><Linkify>{meeting.location}</Linkify></span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onShare}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
        >
          {copied ? <Check size={16} /> : <Share2 size={16} />}
          {copied ? 'Link copied' : 'Share'}
        </button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2">
        <Stat icon={Hourglass} tone="green" label="Length" value={`${len}h`} />
        <Stat icon={Users} tone="blue" label="Attendees" value={attendees.length} />
      </div>

      {/* Attendees */}
      <div className="mt-6 rounded-xl border border-ink-200 bg-surface p-5">
        <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-ink-900">
          <Users size={16} className="text-ink-400" /> Attendees · {attendees.length}
        </h2>
        {attendees.length === 0 ? (
          <p className="text-sm text-ink-400">No one listed yet.</p>
        ) : (
          <div className="flex flex-wrap gap-x-4 gap-y-3">
            {attendees.map((a) => (
              <div key={a.id} className="flex items-center gap-2">
                <Avatar size="sm" initials={initials(a.name)} tone={roleTones[a.role] ?? 'blue'} src={a.avatar_url} />
                <span className="text-sm text-ink-700">{a.name}</span>
                {a.attend_role === 'contributor' && (
                  <span className="rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-bold text-gold-700" title="Contributor (+1 hr)">+1</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      {meeting.notes && (
        <div className="mt-6 rounded-xl border border-ink-200 bg-surface p-5">
          <h2 className="mb-2 font-semibold text-ink-900">Notes</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-600"><Linkify>{meeting.notes}</Linkify></p>
        </div>
      )}

      {/* Links */}
      {links.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-ink-900">
            <Link2 size={16} className="text-ink-400" /> Links
          </h2>
          <div className="flex flex-wrap gap-2">
            {links.map((url, i) => (
              <LinkChip key={i} url={url} size="lg" />
            ))}
          </div>
        </div>
      )}

      <footer className="mt-12 flex items-center gap-2 border-t border-ink-200 pt-6 text-sm text-ink-500">
        <span>Janyaa BCP</span>
        <span aria-hidden>·</span>
        <Link to="/privacy" className="hover:text-ink-800">Privacy</Link>
        <span aria-hidden>·</span>
        <Link to="/terms" className="hover:text-ink-800">Terms</Link>
      </footer>
    </>
  )
}

function Stat({ icon: Icon, label, value, tone }) {
  const tones = { green: 'bg-green-50 text-green-600', gold: 'bg-gold-100 text-gold-700', blue: 'bg-blue-50 text-blue-500' }
  return (
    <div className="rounded-xl border border-ink-200 bg-surface p-4">
      <span className={`grid h-9 w-9 place-items-center rounded-md ${tones[tone] ?? tones.green}`}>
        <Icon size={18} />
      </span>
      <p className="mt-3 font-display text-2xl font-bold tabular-nums text-ink-900">{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  )
}
