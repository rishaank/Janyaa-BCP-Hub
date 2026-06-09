import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Mail, CalendarPlus, Repeat, List, CalendarDays, CalendarClock } from 'lucide-react'
import { PageHeader, Card, Button } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import {
  getEvents,
  getMeetings,
  ensureUpcomingMeetings,
  autoGenerateInsights,
  sendRemindersNow,
} from '../lib/api'
import { useRealtime } from '../lib/useRealtime'
import EventsCalendar from '../components/EventsCalendar'
import { EventCard, EventFormModal, CalendarSubscribeModal } from './Events'
import { MeetingCard, MeetingFormModal, SeriesModal } from './Meetings'

const TODAY = new Date().toISOString().slice(0, 10)

const segBtn = (active) =>
  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'bg-green-600 text-white shadow-xs' : 'text-ink-600 hover:text-ink-900'
  }`

// Events and Meetings merged into one tab. A toggle picks which list you see; the
// calendar view shows both at once. `?tab=meetings` deep-links the meetings list.
export default function EventsMeetings() {
  const { user, profile } = useAuth()
  const isAdmin = !!profile?.is_admin

  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'meetings' ? 'meetings' : 'events'
  const setTab = (t) => setParams(t === 'meetings' ? { tab: 'meetings' } : {}, { replace: true })
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
  const [reminding, setReminding] = useState('')

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

  async function remindNow() {
    setReminding('Sending…')
    const { data, error } = await sendRemindersNow()
    if (error || !data?.ok) setReminding('Failed')
    else setReminding(data.sent > 0 ? `Sent ${data.sent}` : 'Nothing due')
    setTimeout(() => setReminding(''), 2500)
  }

  // Event buckets
  const tentative = events.filter((e) => e.is_tentative)
  const upcomingEvents = events.filter((e) => !e.is_tentative && e.date && e.date >= TODAY)
  const pastEvents = events.filter((e) => !e.is_tentative && e.date && e.date < TODAY).reverse()
  // Meeting buckets
  const upcomingMeetings = meetings.filter((m) => m.date >= TODAY)
  const pastMeetings = meetings.filter((m) => m.date < TODAY).reverse()

  const openCreateEvent = () => { setEditEvent(null); setEventForm(true) }
  const openEditEvent = (ev) => { setEditEvent(ev); setEventForm(true) }
  const openCreateMeeting = () => { setEditMeeting(null); setMeetingForm(true) }
  const openEditMeeting = (m) => { setEditMeeting(m); setMeetingForm(true) }

  return (
    <>
      <PageHeader
        title="Events & Meetings"
        subtitle="Manage and view events, meetings, and attendance."
        action={
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
            {view === 'calendar' ? (
              <>
                <Button variant="soft" icon={CalendarPlus} onClick={() => setShowSubscribe(true)}>Subscribe</Button>
                <Button variant="soft" icon={Plus} onClick={openCreateMeeting}>Add meeting</Button>
                <Button icon={Plus} onClick={openCreateEvent}>Add event</Button>
              </>
            ) : tab === 'events' ? (
              <>
                {isAdmin && (
                  <Button variant="soft" icon={Mail} onClick={remindNow} disabled={reminding === 'Sending…'}>
                    {reminding || 'Email reminders'}
                  </Button>
                )}
                <Button variant="soft" icon={CalendarPlus} onClick={() => setShowSubscribe(true)}>Subscribe</Button>
                <Button icon={Plus} onClick={openCreateEvent}>Add event</Button>
              </>
            ) : (
              <>
                <Button variant="soft" icon={Repeat} onClick={() => setSeriesOpen(true)}>Recurring</Button>
                <Button icon={Plus} onClick={openCreateMeeting}>Add meeting</Button>
              </>
            )}
          </div>
        }
      />

      {loading ? (
        <LoadingRows />
      ) : view === 'calendar' ? (
        <EventsCalendar
          events={events}
          meetings={meetings}
          onSelectEvent={openEditEvent}
          onSelectMeeting={openEditMeeting}
        />
      ) : tab === 'events' ? (
        <>
          <Section title="Upcoming" count={upcomingEvents.length}>
            {upcomingEvents.map((e) => (
              <EventCard key={e.id} event={e} myId={user?.id} onChange={loadEvents} onEdit={openEditEvent} />
            ))}
          </Section>
          {tentative.length > 0 && (
            <Section title="Tentative" count={tentative.length}>
              {tentative.map((e) => (
                <EventCard key={e.id} event={e} myId={user?.id} onChange={loadEvents} onEdit={openEditEvent} />
              ))}
            </Section>
          )}
          <Section title="Past" count={pastEvents.length}>
            {pastEvents.map((e) => (
              <EventCard key={e.id} event={e} myId={user?.id} onChange={loadEvents} onEdit={openEditEvent} />
            ))}
          </Section>
        </>
      ) : (
        <>
          <Section title="Upcoming" count={upcomingMeetings.length}>
            {upcomingMeetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} myId={user?.id} onChange={loadMeetings} onEdit={openEditMeeting} />
            ))}
          </Section>
          <Section title="Past" count={pastMeetings.length}>
            {pastMeetings.map((m) => (
              <MeetingCard key={m.id} meeting={m} myId={user?.id} onChange={loadMeetings} onEdit={openEditMeeting} />
            ))}
          </Section>
        </>
      )}

      <EventFormModal
        open={eventForm}
        event={editEvent}
        events={events}
        onClose={() => setEventForm(false)}
        onSaved={() => {
          setEventForm(false)
          loadEvents()
          autoGenerateInsights() // new/edited event → refresh AI insights (throttled)
        }}
      />
      <CalendarSubscribeModal open={showSubscribe} onClose={() => setShowSubscribe(false)} />
      <MeetingFormModal
        open={meetingForm}
        meeting={editMeeting}
        onClose={() => setMeetingForm(false)}
        onSaved={() => {
          setMeetingForm(false)
          loadMeetings()
        }}
      />
      <SeriesModal open={seriesOpen} onClose={() => setSeriesOpen(false)} onChange={loadMeetings} />
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
        <p className="text-sm text-ink-400">Nothing here yet.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">{children}</div>
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
