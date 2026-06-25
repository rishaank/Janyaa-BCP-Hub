import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, CalendarPlus, Repeat, List, CalendarDays, CalendarClock } from 'lucide-react'
import { PageHeader, Card, Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import {
  getEvents,
  getMeetings,
  ensureUpcomingMeetings,
  autoGenerateInsights,
} from '../lib/api'
import { useRealtime } from '../lib/useRealtime'
import { useIsDesktop } from '../lib/useMediaQuery'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import EventsCalendar from '../components/EventsCalendar'
import { EventCard, EventFormModal, CalendarSubscribeModal } from './Events'
import { MeetingCard, MeetingFormModal, SeriesModal } from './Meetings'

const TODAY = new Date().toISOString().slice(0, 10)

// "now" in PST/PDT as naive parts — compare to stored LA-local times without DST math.
function laNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${(p.hour === '24' ? '00' : p.hour)}:${p.minute}` }
}
// A meeting becomes "past" once its end time (or end of day if untimed) passes in PST.
function meetingEnded(m, now) {
  if (m.date < now.date) return true
  if (m.date > now.date) return false
  const end = (m.end_time || '').slice(0, 5) || '23:59'
  return end <= now.time
}

const segBtn = (active) =>
  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'bg-green-600 text-white shadow-xs' : 'text-ink-600 hover:text-ink-900'
  }`

// Events and Meetings merged into one tab. A toggle picks which list you see; the
// calendar view shows both at once. `?tab=meetings` deep-links the meetings list.
export default function EventsMeetings() {
  const { user, profile } = useAuth()
  const isAdmin = !!profile?.is_admin

  const isDesktop = useIsDesktop()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'meetings' ? 'meetings' : 'events'
  const setTab = (t) => setParams(t === 'meetings' ? { tab: 'meetings' } : {}, { replace: true })
  useDocumentTitle(tab === 'meetings' ? 'Meetings' : 'Events')
  const [view, setView] = useState('list') // 'list' | 'calendar' (calendar shows both)

  const [events, setEvents] = useState([])
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals + transient state
  const [eventForm, setEventForm] = useState(false)
  const [editEvent, setEditEvent] = useState(null)
  const [showSubscribe, setShowSubscribe] = useState(false)
  const [meetingForm, setMeetingForm] = useState(false)
  const [editMeeting, setEditMeeting] = useState(null)
  const [seriesOpen, setSeriesOpen] = useState(false)

  const loadEvents = () => getEvents().then(setEvents)
  const loadMeetings = () => getMeetings().then(setMeetings)

  useEffect(() => {
    // Materialize any missing recurring meeting occurrences, then load both sets.
    ensureUpcomingMeetings()
      .then(() => Promise.all([loadEvents(), loadMeetings()]))
      .then(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useRealtime(['events', 'event_signups', 'event_todos'], loadEvents)
  useRealtime(['meetings', 'meeting_series', 'meeting_attendees'], loadMeetings)

  // Event buckets
  const tentative = events.filter((e) => e.is_tentative)
  const upcomingEvents = events.filter((e) => !e.is_tentative && e.date && e.date >= TODAY)
  const pastEvents = events.filter((e) => !e.is_tentative && e.date && e.date < TODAY).reverse()
  // Meeting buckets — end-time aware (a meeting moves to Past when it ends, PST)
  const now = laNow()
  const upcomingMeetings = meetings.filter((m) => !meetingEnded(m, now))
  const pastMeetings = meetings.filter((m) => meetingEnded(m, now)).reverse()

  const openCreateEvent = () => { setEditEvent(null); setEventForm(true) }
  const openEditEvent = (ev) => { setEditEvent(ev); setEventForm(true) }
  const openCreateMeeting = () => { setEditMeeting(null); setMeetingForm(true) }
  const openEditMeeting = (m) => { setEditMeeting(m); setMeetingForm(true) }

  // Shared add/edit/subscribe modals — rendered in both the desktop and mobile trees.
  const modals = (
    <>
      <EventFormModal
        open={eventForm}
        event={editEvent}
        events={events}
        onClose={() => setEventForm(false)}
        onSaved={() => { setEventForm(false); loadEvents(); autoGenerateInsights() }}
      />
      <CalendarSubscribeModal open={showSubscribe} onClose={() => setShowSubscribe(false)} />
      <MeetingFormModal
        open={meetingForm}
        meeting={editMeeting}
        onClose={() => setMeetingForm(false)}
        onSaved={() => { setMeetingForm(false); loadMeetings() }}
      />
      <SeriesModal open={seriesOpen} onClose={() => setSeriesOpen(false)} onChange={loadMeetings} />
    </>
  )

  if (!isDesktop)
    return (
      <>
        <div className="jh-pagehead">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="jh-h1">Events &amp; Meetings</h1>
            <p className="jh-sub">Events, meetings, and attendance.</p>
          </div>
          <button className="jh-action-btn" onClick={() => setShowSubscribe(true)}><CalendarPlus size={15} /> Subscribe</button>
        </div>

        <div className="seg-bar">
          <span className="jh-seg">
            <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}><List size={14} /> List</button>
            <button className={view === 'calendar' ? 'on' : ''} onClick={() => setView('calendar')}><CalendarDays size={14} /> Calendar</button>
          </span>
          {view === 'list' && (
            <span className="jh-seg">
              <button className={tab === 'events' ? 'on' : ''} onClick={() => setTab('events')}>Events</button>
              <button className={tab === 'meetings' ? 'on' : ''} onClick={() => setTab('meetings')}>Meetings</button>
            </span>
          )}
          {view === 'list' && tab === 'meetings' && (
            <button className="jh-action-btn" onClick={() => setSeriesOpen(true)}><Repeat size={14} /> Recurring</button>
          )}
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 18 }}>
            {[0, 1, 2].map((i) => <div key={i} className="jh-card" style={{ height: 150, background: 'var(--ink-50)' }} />)}
          </div>
        ) : view === 'calendar' ? (
          <div style={{ marginTop: 16 }}>
            <EventsCalendar events={events} meetings={meetings} onSelectEvent={openEditEvent} onSelectMeeting={openEditMeeting} />
          </div>
        ) : tab === 'events' ? (
          <>
            <MobileSection title="Upcoming" count={upcomingEvents.length}>
              {upcomingEvents.map((e) => (
                <EventCard key={e.id} event={e} myId={user?.id} isAdmin={isAdmin} onChange={loadEvents} onEdit={openEditEvent} />
              ))}
            </MobileSection>
            {tentative.length > 0 && (
              <MobileSection title="Tentative" count={tentative.length}>
                {tentative.map((e) => (
                  <EventCard key={e.id} event={e} myId={user?.id} isAdmin={isAdmin} onChange={loadEvents} onEdit={openEditEvent} />
                ))}
              </MobileSection>
            )}
            <MobileSection title="Past" count={pastEvents.length}>
              {pastEvents.map((e) => (
                <EventCard key={e.id} event={e} myId={user?.id} isAdmin={isAdmin} onChange={loadEvents} onEdit={openEditEvent} />
              ))}
            </MobileSection>
          </>
        ) : (
          <>
            <MobileSection title="Upcoming" count={upcomingMeetings.length}>
              {upcomingMeetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} myId={user?.id} isAdmin={isAdmin} isPast={false} onChange={loadMeetings} onEdit={openEditMeeting} />
              ))}
            </MobileSection>
            <MobileSection title="Past" count={pastMeetings.length}>
              {pastMeetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} myId={user?.id} isAdmin={isAdmin} isPast onChange={loadMeetings} onEdit={openEditMeeting} />
              ))}
            </MobileSection>
          </>
        )}

        {view !== 'calendar' && (
          <button
            className="jh-fab"
            onClick={tab === 'meetings' ? openCreateMeeting : openCreateEvent}
            aria-label={tab === 'meetings' ? 'Add meeting' : 'Add event'}
          >
            <Plus size={24} /> {tab === 'meetings' ? 'Meeting' : 'Event'}
          </button>
        )}

        {modals}
      </>
    )

  return (
    <>
      <PageHeader
        title="Events & Meetings"
        subtitle="Manage and view events, meetings, and attendance."
        action={
          // Two rows on mobile (view toggles, then action buttons); one wrapped row on desktop.
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {/* Row 1 — view toggles */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-ink-200 bg-surface p-0.5">
                <button onClick={() => setView('list')} className={segBtn(view === 'list')}>
                  <List size={15} /> List
                </button>
                <button onClick={() => setView('calendar')} className={segBtn(view === 'calendar')}>
                  <CalendarDays size={15} /> Calendar
                </button>
              </div>
              {view === 'list' && (
                <div className="inline-flex rounded-lg border border-ink-200 bg-surface p-0.5">
                  <button onClick={() => setTab('events')} className={segBtn(tab === 'events')}>
                    <CalendarDays size={15} /> Events
                  </button>
                  <button onClick={() => setTab('meetings')} className={segBtn(tab === 'meetings')}>
                    <CalendarClock size={15} /> Meetings
                  </button>
                </div>
              )}
            </div>
            {/* Row 2 — actions */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Subscribe stays put in every view so it doesn't jump between tabs. */}
              <Button variant="soft" icon={CalendarPlus} onClick={() => setShowSubscribe(true)}>Subscribe</Button>
              {view === 'calendar' ? (
                <>
                  <Button variant="soft" icon={Plus} onClick={openCreateMeeting}>Add Meeting</Button>
                  <Button icon={Plus} onClick={openCreateEvent}>Add Event</Button>
                </>
              ) : tab === 'events' ? (
                <Button icon={Plus} onClick={openCreateEvent}>Add Event</Button>
              ) : (
                <>
                  <Button variant="soft" icon={Repeat} onClick={() => setSeriesOpen(true)}>Recurring</Button>
                  <Button icon={Plus} onClick={openCreateMeeting}>Add Meeting</Button>
                </>
              )}
            </div>
          </div>
        }
      />

      {loading ? (
        <LoadingRows />
      ) : view === 'calendar' ? (
        <div className="ja-fade">
          <EventsCalendar
            events={events}
            meetings={meetings}
            onSelectEvent={openEditEvent}
            onSelectMeeting={openEditMeeting}
          />
        </div>
      ) : tab === 'events' ? (
        <>
          <Section title="Upcoming" count={upcomingEvents.length}>
            {upcomingEvents.map((e) => (
              <EventCard key={e.id} event={e} myId={user?.id} isAdmin={isAdmin} onChange={loadEvents} onEdit={openEditEvent} />
            ))}
          </Section>
          {tentative.length > 0 && (
            <Section title="Tentative" count={tentative.length}>
              {tentative.map((e) => (
                <EventCard key={e.id} event={e} myId={user?.id} isAdmin={isAdmin} onChange={loadEvents} onEdit={openEditEvent} />
              ))}
            </Section>
          )}
          <Section title="Past" count={pastEvents.length}>
            {pastEvents.map((e) => (
              <EventCard key={e.id} event={e} myId={user?.id} isAdmin={isAdmin} onChange={loadEvents} onEdit={openEditEvent} />
            ))}
          </Section>
        </>
      ) : (
        <>
          <Section title="Upcoming" count={upcomingMeetings.length}>
            {upcomingMeetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} myId={user?.id} isAdmin={isAdmin} isPast={false} onChange={loadMeetings} onEdit={openEditMeeting} />
            ))}
          </Section>
          <Section title="Past" count={pastMeetings.length}>
            {pastMeetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} myId={user?.id} isAdmin={isAdmin} isPast onChange={loadMeetings} onEdit={openEditMeeting} />
            ))}
          </Section>
        </>
      )}

      {modals}
    </>
  )
}

// Single-column section for the mobile list (overline header + stacked cards).
function MobileSection({ title, count, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div className="jh-overline" style={{ marginBottom: 10 }}>{title} · {count}</div>
      {count === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--ink-400)' }}>Nothing here yet.</p>
      ) : (
        <div className="ja-stagger" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
      )}
    </div>
  )
}

function Section({ title, count, children }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-2xs font-semibold uppercase tracking-[0.08em] text-ink-500">
        {title} · {count}
      </h2>
      {count === 0 ? (
        <p className="text-sm text-ink-400">Nothing here yet.</p>
      ) : (
        <div className="ja-stagger grid gap-4 lg:grid-cols-2">{children}</div>
      )}
    </section>
  )
}

function LoadingRows() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="h-40 animate-pulse bg-ink-50" />
      ))}
    </div>
  )
}
