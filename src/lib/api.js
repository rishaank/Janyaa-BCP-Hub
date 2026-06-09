import { supabase } from './supabase'

const TODAY = () => new Date().toISOString().slice(0, 10)

// ---- Members -------------------------------------------------------------

// All profiles plus hours earned. Hours = sum of `hours` for every PAST event
// the member signed up for (signing up for events is how hours are tracked).
// The current club term label (season + year), computed from today so it rolls
// over automatically. Mirrors the server-side current_term_start().
export function currentTerm(date = new Date()) {
  const m = date.getMonth() // 0 = Jan
  const y = date.getFullYear()
  if (m === 11) return `Winter ${y}` // Dec
  if (m <= 1) return `Winter ${y - 1}` // Jan, Feb belong to the winter that began last Dec
  if (m <= 4) return `Spring ${y}` // Mar–May
  if (m <= 7) return `Summer ${y}` // Jun–Aug
  return `Fall ${y}` // Sep–Nov
}

export async function getMembersWithHours() {
  // Totals come from the unified hours breakdown (ledger + cutoff-filtered event
  // sign-ups + meeting attendance + admin adjustment) so every screen agrees.
  const [{ data: profiles }, { data: breakdowns }] = await Promise.all([
    supabase.from('profiles').select('*').order('joined_date'),
    supabase.rpc('get_hours_breakdowns', { p_member: null }),
  ])
  const byId = {}
  for (const b of breakdowns ?? []) byId[b.member_id] = b
  return (profiles ?? []).map((p) => ({
    ...p,
    hours: Number(byId[p.id]?.total ?? 0),
    term_hours: Number(byId[p.id]?.term_total ?? 0),
    avatar: initials(p.name),
  }))
}

// Per-member itemized hours history (Feature 3). Pass null for everyone (export).
export async function getHoursBreakdowns(memberId = null) {
  const { data } = await supabase.rpc('get_hours_breakdowns', { p_member: memberId })
  return data ?? []
}

// ---- Editable hours ledger (admin) ---------------------------------------
// Admins log / edit / remove individual ledger rows on a member's profile —
// e.g. logging event hours, or fixing an imported entry. RLS gates writes to
// admins (migration 0022). Each breakdown entry carries a `grant_id` for the
// ledger rows these target; derived sign-up/meeting rows have none.
export function addHoursEntry({ memberId, hours, note, entryDate, eventId }) {
  return supabase.from('hours_grants').insert({
    member_id: memberId,
    hours: Number(hours),
    source: 'manual',
    note: note || null,
    entry_date: entryDate || null,
    event_id: eventId || null,
  })
}
export function updateHoursEntry(id, fields) {
  return supabase.from('hours_grants').update(fields).eq('id', id)
}
export function deleteHoursEntry(id) {
  return supabase.from('hours_grants').delete().eq('id', id)
}

// A light event list (id, name, date) for linking a hours entry to an event.
export async function getEventsBrief() {
  const { data } = await supabase.from('events').select('id, name, date').order('date', { ascending: false })
  return data ?? []
}

// ---- Hours requests (member → operations lead, migration 0023) ------------

// Submit a request for hours to the operations lead. A member requests for
// themselves; an admin may request on behalf of another member (the RPC records
// who submitted it and enforces the rule).
export async function submitHoursRequest({ requesterId, activity, hours, contribution }) {
  const { data, error } = await supabase.rpc('submit_hours_request', {
    p_requester: requesterId,
    p_activity: activity,
    p_hours: Number(hours),
    p_contribution: contribution || null,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

// Ops-lead view: every request with requester + reviewer + submitter info, newest first.
export async function getHoursRequests() {
  const { data } = await supabase
    .from('hours_requests')
    .select(
      `*,
       requester:profiles!hours_requests_requester_id_fkey ( id, name, role, avatar_url, email ),
       reviewer:profiles!hours_requests_reviewer_id_fkey ( id, name ),
       submitter:profiles!hours_requests_submitted_by_fkey ( id, name )`,
    )
    .order('created_at', { ascending: false })
  return data ?? []
}

// Count of still-pending requests — the sidebar notification badge (ops lead).
export async function getPendingRequestCount() {
  const { count } = await supabase
    .from('hours_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  return count ?? 0
}

// Ops lead approves (auto-grants the hours) or denies (reason required) a request.
export function decideHoursRequest(id, approve, reason = null) {
  return supabase.rpc('decide_hours_request', { p_id: id, p_approve: approve, p_reason: reason })
}

// The signed-in member's request cards for the dashboard: still-pending (always
// shown) plus approved/denied that haven't been dismissed yet. Pending rows are
// never dismissable, so filtering on dismissed=false yields exactly the cards.
export async function getMyHoursRequests(memberId) {
  const { data } = await supabase
    .from('hours_requests')
    .select(`*, reviewer:profiles!hours_requests_reviewer_id_fkey ( name )`)
    .eq('requester_id', memberId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
  return data ?? []
}

// Requester dismisses a denied-request card so it stops showing on their dashboard.
export function dismissHoursRequest(id) {
  return supabase.rpc('dismiss_hours_request', { p_id: id })
}

// Admin-only: update any member's profile (name, role, hours_adjustment, is_admin).
// Allowed by RLS only when the caller is an admin.
export function adminUpdateProfile(id, fields) {
  return supabase.from('profiles').update(fields).eq('id', id)
}

// Full detail for one member: profile + the events they signed up for + the
// to-dos they took responsibility for + their total hours.
export async function getProfileDetails(id) {
  const [{ data: profile }, { data: signups }, { data: todos }, { data: bd }, { data: goals }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase.from('event_signups').select('events ( id, name, date, location, raised, hours )').eq('member_id', id),
    supabase.from('event_todos').select('id, item, done, events ( id, name, date )').eq('assignee_id', id),
    supabase.rpc('get_hours_breakdowns', { p_member: id }),
    supabase.from('goals').select('id, title, detail, progress, status, target_date').eq('owner_id', id).order('created_at', { ascending: false }),
  ])
  const events = (signups ?? []).map((s) => s.events).filter(Boolean)
  const breakdown = (bd ?? [])[0] ?? null
  return {
    profile: profile ? { ...profile, avatar: initials(profile.name) } : null,
    events,
    todos: todos ?? [],
    goals: goals ?? [],
    hours: Number(breakdown?.total ?? 0),
    breakdown, // { total, term_total, entries: [{date,hours,description,kind,event_id,meeting_id}] }
  }
}

// Upload (or replace) a member's profile picture and store its public URL.
export async function uploadAvatar(userId, file) {
  const path = `${userId}/avatar`
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, cacheControl: '3600', contentType: file.type })
  if (upErr) return { error: upErr }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = `${data.publicUrl}?v=${Date.now()}` // cache-bust so the new image shows
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
  return { url, error }
}

// Revert to the default initials avatar.
export function removeAvatar(userId) {
  return supabase.from('profiles').update({ avatar_url: null }).eq('id', userId)
}

// ---- Auto hours (role-based grants) --------------------------------------

// The editable per-role rules (how many hours, how often). Admin-only to edit.
export async function getRoleHoursRules() {
  const { data } = await supabase.from('role_hours_rules').select('*')
  return data ?? []
}

export function updateRoleHoursRule(role, fields) {
  return supabase
    .from('role_hours_rules')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('role', role)
}

// Materialize this month's monthly grants now (idempotent). Cron also runs it
// on the 1st; this lets an admin top up the current month on demand.
export function ensureMonthlyRoleHours() {
  return supabase.rpc('ensure_monthly_role_hours')
}

// ---- Events --------------------------------------------------------------

// Events with their signups (incl. member names) and to-dos, newest first.
export async function getEvents() {
  const { data } = await supabase
    .from('events')
    .select(
      `*,
       event_signups ( member_id, profiles ( id, name, role ) ),
       event_todos ( id, item, done, assignee_id, profiles ( id, name, role ) )`,
    )
    .order('date', { ascending: true })
  return data ?? []
}

export function signUpForEvent(eventId, memberId) {
  return supabase.from('event_signups').insert({ event_id: eventId, member_id: memberId })
}

export function leaveEvent(eventId, memberId) {
  return supabase
    .from('event_signups')
    .delete()
    .eq('event_id', eventId)
    .eq('member_id', memberId)
}

export function createEvent(fields) {
  return supabase.from('events').insert(fields).select().single()
}

export function updateEvent(id, fields) {
  return supabase.from('events').update(fields).eq('id', id)
}

export function deleteEvent(id) {
  return supabase.from('events').delete().eq('id', id)
}

export function deleteTodo(id) {
  return supabase.from('event_todos').delete().eq('id', id)
}

export function addTodo(eventId, item) {
  return supabase.from('event_todos').insert({ event_id: eventId, item })
}

// Claim/unclaim a to-do (assign to a member or clear it).
export function setTodoAssignee(todoId, assigneeId) {
  return supabase.from('event_todos').update({ assignee_id: assigneeId }).eq('id', todoId)
}

// Mark a to-do brought / not brought.
export function setTodoDone(todoId, done) {
  return supabase.from('event_todos').update({ done }).eq('id', todoId)
}

// ---- Meetings ------------------------------------------------------------

// All meetings with their attendees (incl. member names), earliest first.
export async function getMeetings() {
  const { data } = await supabase
    .from('meetings')
    .select(`*, meeting_attendees ( member_id, role, profiles ( id, name, role ) )`)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true, nullsFirst: false })
  return data ?? []
}

// The recurring meeting schedules (e.g. "every Thursday at 4pm").
export async function getMeetingSeries() {
  const { data } = await supabase.from('meeting_series').select('*').order('weekday')
  return data ?? []
}

export function createMeeting(fields) {
  return supabase.from('meetings').insert(fields).select().single()
}
export function updateMeeting(id, fields) {
  return supabase.from('meetings').update(fields).eq('id', id)
}
export function deleteMeeting(id) {
  return supabase.from('meetings').delete().eq('id', id)
}
// Cancel / restore a single occurrence (keeps the row so it isn't regenerated).
export function setMeetingCanceled(id, canceled) {
  return supabase.from('meetings').update({ canceled }).eq('id', id)
}

export function createMeetingSeries(fields) {
  return supabase.from('meeting_series').insert(fields).select().single()
}
export function updateMeetingSeries(id, fields) {
  return supabase.from('meeting_series').update(fields).eq('id', id)
}
export function deleteMeetingSeries(id) {
  return supabase.from('meeting_series').delete().eq('id', id)
}
// Clear a series' still-upcoming auto-created occurrences (call before deleting
// the series). Past meetings stay for the record.
export function deleteSeriesUpcomingMeetings(seriesId) {
  return supabase.from('meetings').delete().eq('series_id', seriesId).gte('date', isoLocal(new Date()))
}

// Register for a meeting as an attendee or contributor (own-row). Upsert so you
// can switch roles. Contributor earns meeting length + 1 hr; attendee earns length.
export function registerMeeting(meetingId, memberId, role = 'attendee') {
  return supabase
    .from('meeting_attendees')
    .upsert({ meeting_id: meetingId, member_id: memberId, role }, { onConflict: 'meeting_id,member_id' })
}
export function unmarkAttendance(meetingId, memberId) {
  return supabase.from('meeting_attendees').delete().eq('meeting_id', meetingId).eq('member_id', memberId)
}

// ---- Pinned AI cards (Feature 1) -----------------------------------------
// Any signed-in member can pin an AI insight / suggestion / social idea so it
// survives regeneration. `surface` groups pins by where they were pinned.
export async function getPins(surface) {
  let q = supabase.from('pinned_items').select('*').order('created_at', { ascending: false })
  if (surface) q = q.eq('surface', surface)
  const { data } = await q
  return data ?? []
}
export function addPin({ surface, kind, payload, by }) {
  return supabase.from('pinned_items').insert({ surface, kind, payload, pinned_by: by })
}
export function removePin(id) {
  return supabase.from('pinned_items').delete().eq('id', id)
}

// Materialize concrete meeting rows from every active recurring series for the
// next `weeks` weeks. Idempotent: skips any (series, date) that already has a
// row, so cancelled/edited occurrences are never recreated. Best-effort — safe
// to call on every Meetings-page load; races are caught by the unique index.
export async function ensureUpcomingMeetings(weeks = 8) {
  const { data: series } = await supabase.from('meeting_series').select('*').eq('active', true)
  if (!series?.length) return false

  const todayIso = isoLocal(new Date())
  const { data: existing } = await supabase
    .from('meetings')
    .select('series_id, date')
    .not('series_id', 'is', null)
    .gte('date', todayIso)
  const have = new Set((existing ?? []).map((m) => `${m.series_id}|${m.date}`))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const rows = []
  for (const s of series) {
    for (let w = 0; w < weeks; w++) {
      const iso = isoLocal(nextWeekday(today, s.weekday, w))
      if (have.has(`${s.id}|${iso}`)) continue
      rows.push({
        series_id: s.id,
        title: s.title,
        date: iso,
        start_time: s.start_time,
        end_time: s.end_time,
        location: s.location,
        notes: s.notes,
      })
    }
  }
  if (!rows.length) return false
  const { error } = await supabase.from('meetings').insert(rows)
  return !error // a lost race (unique-index conflict) just means someone else generated them
}

// ---- Leadership goals ----------------------------------------------------

export async function getGoals() {
  const { data } = await supabase
    .from('goals')
    .select(`*, owner:profiles!goals_owner_id_fkey ( id, name, role, avatar_url )`)
    .order('created_at', { ascending: false })
  return data ?? []
}

export function createGoal(fields) {
  return supabase.from('goals').insert(fields).select().single()
}
export function updateGoal(id, fields) {
  return supabase.from('goals').update(fields).eq('id', id)
}
export function deleteGoal(id) {
  return supabase.from('goals').delete().eq('id', id)
}

// ---- Fundraising ---------------------------------------------------------

export async function getFundraisingEvents() {
  const { data } = await supabase
    .from('events')
    .select('id, name, date, location, raised')
    .gt('raised', 0)
    .order('date', { ascending: true })
  return data ?? []
}

// ---- Club settings (shared goal + GoFundMe sync) -------------------------

// The single shared settings row (raise_target + latest GoFundMe figures).
export async function getSettings() {
  const { data } = await supabase.from('club_settings').select('*').eq('id', true).single()
  return data
}

// The whole dashboard as one blob, readable WITHOUT a session (Feature 6).
// A SECURITY DEFINER RPC returns exactly what the dashboard renders — counts,
// term + all-time hours, fundraising, the hours leaderboard, AI insights,
// active goals, and the upcoming events + meetings lists — and nothing else
// (no emails, no raw tables) so it's safe for anonymous visitors.
export async function getPublicDashboard() {
  const { data, error } = await supabase.rpc('get_public_dashboard')
  if (error) return null
  return data
}

// One event's public data for the shareable full-screen view (Feature 2), readable
// without a session (no emails) via a SECURITY DEFINER RPC.
export async function getPublicEvent(id) {
  const { data, error } = await supabase.rpc('get_public_event', { p_id: id })
  if (error) return null
  return data
}

// ---- AI tools (suggestions / planner / social) ---------------------------

// Regenerate cached next-event + location suggestions (Feature 3).
export async function generateSuggestions() {
  try {
    return await supabase.functions.invoke('ai-suggestions')
  } catch (error) {
    return { data: null, error }
  }
}

// Ask the AI planner to draft a full event from the wizard answers (Feature 4).
// Returns { data: { ok, plan }, error } — the caller saves it on accept.
export async function planEvent(answers) {
  try {
    return await supabase.functions.invoke('ai-plan-event', { body: { answers } })
  } catch (error) {
    return { data: null, error }
  }
}

// Regenerate the monthly social-media suggestions (Feature 5). `force` re-runs even
// if the cache is fresh; the monthly cron passes `scheduled` instead.
export async function generateSocial(force = false) {
  try {
    return await supabase.functions.invoke('ai-social', { body: { force } })
  } catch (error) {
    return { data: null, error }
  }
}

// Anyone signed in can change the fundraising goal — it applies for everyone.
export function updateRaiseTarget(value) {
  return supabase.from('club_settings').update({ raise_target: value }).eq('id', true)
}

// Ask the server-side scraper (Edge Function) to refresh the GoFundMe totals.
// Returns { error } so callers can no-op gracefully if it isn't deployed yet.
export async function syncGoFundme() {
  try {
    return await supabase.functions.invoke('sync-gofundme')
  } catch (error) {
    return { data: null, error }
  }
}

// Ask the ai-insights Edge Function to regenerate insights from live club data.
export async function generateInsights() {
  try {
    return await supabase.functions.invoke('ai-insights')
  } catch (error) {
    return { data: null, error }
  }
}

// Background, throttled auto-regen: only re-runs if the cached insights are older
// than `minMinutes`. Called after real data changes (new event, GoFundMe change).
export async function autoGenerateInsights(minMinutes = 10) {
  try {
    const { data } = await supabase.from('club_settings').select('ai_insights_at').eq('id', true).single()
    const ageMin = data?.ai_insights_at ? (Date.now() - new Date(data.ai_insights_at).getTime()) / 60000 : Infinity
    if (ageMin < minMinutes) return
    await supabase.functions.invoke('ai-insights')
  } catch {
    /* best effort — never blocks the UI */
  }
}

// ---- Locations -----------------------------------------------------------

export async function getLocations() {
  const { data } = await supabase.from('locations').select('*').order('saved_at', { ascending: false })
  return data ?? []
}

export function saveLocation(fields) {
  return supabase.from('locations').insert(fields).select().single()
}

export function updateLocation(id, fields) {
  return supabase.from('locations').update(fields).eq('id', id)
}

export function deleteLocation(id) {
  return supabase.from('locations').delete().eq('id', id)
}

// ---- Activity log (admin-only) -------------------------------------------

// The audit trail, newest first. RLS returns rows only for admins.
export async function getActivityLog(limit = 150) {
  const { data } = await supabase
    .from('activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data ?? []
}

// ---- Admin user management (Edge Function: admin-users) ------------------

const setPwRedirect = () => `${window.location.origin}/set-password`

// Invoke the admin-users function and normalize the result to { ok, error, data }
// (so callers can show the server's message on 4xx without unwrapping the error).
async function callAdminUsers(payload) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload })
  if (error) {
    let msg = error.message
    try {
      const body = await error.context.json()
      if (body?.error) msg = body.error
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg }
  }
  return { ok: true, data }
}

// Create an account with a password the admin sets (member can sign in right away).
export const adminCreateUser = ({ email, name, password }) =>
  callAdminUsers({ action: 'create', email, name, password })

// Create an account and email the member an invite link to set their own password.
export const adminInviteUser = ({ email, name }) =>
  callAdminUsers({ action: 'create', email, name, redirectTo: setPwRedirect() })

// Set a new password directly for a member.
export const adminSetPassword = (id, password) =>
  callAdminUsers({ action: 'setPassword', id, password })

// Change a member's email (admin) — updates the auth account + the profile.
export const adminSetEmail = (id, email) =>
  callAdminUsers({ action: 'setEmail', id, email })

// Email a member a password-reset link.
export const adminSendReset = (email) =>
  callAdminUsers({ action: 'sendReset', email, redirectTo: setPwRedirect() })

// Permanently delete a member's account (auth user + profile).
export const adminDeleteUser = (id) => callAdminUsers({ action: 'delete', id })

// Self-service: the signed-in member deletes THEIR OWN account + data (the
// California SB 568 "eraser" right). No admin needed; sign out after it returns.
export const deleteOwnAccount = () => callAdminUsers({ action: 'deleteSelf' })

// ---- Reminder emails (Edge Function: send-reminders) ---------------------

// Manually trigger tomorrow's to-do reminder emails (admin "Send now" button).
export async function sendRemindersNow() {
  try {
    return await supabase.functions.invoke('send-reminders', { body: {} })
  } catch (error) {
    return { data: null, error }
  }
}

// ---- helpers -------------------------------------------------------------

export function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

// Local YYYY-MM-DD (no UTC shift) — matches how the app reads `event.date`.
function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// The date of the `weekOffset`-th occurrence of `weekday` (0=Sun…6=Sat) on or
// after `from`. weekOffset 0 = the next such weekday (today counts).
function nextWeekday(from, weekday, weekOffset) {
  const d = new Date(from)
  const diff = (weekday - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff + weekOffset * 7)
  return d
}
