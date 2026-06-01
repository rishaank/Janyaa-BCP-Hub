import { supabase } from './supabase'

const TODAY = () => new Date().toISOString().slice(0, 10)

// ---- Members -------------------------------------------------------------

// All profiles plus hours earned. Hours = sum of `hours` for every PAST event
// the member signed up for (signing up for events is how hours are tracked).
export async function getMembersWithHours() {
  const [{ data: profiles }, { data: signups }] = await Promise.all([
    supabase.from('profiles').select('*').order('joined_date'),
    supabase.from('event_signups').select('member_id, events(date, hours)'),
  ])

  const hoursByMember = {}
  for (const s of signups ?? []) {
    const ev = s.events
    if (ev && ev.date < TODAY()) {
      hoursByMember[s.member_id] = (hoursByMember[s.member_id] ?? 0) + Number(ev.hours)
    }
  }

  return (profiles ?? []).map((p) => ({
    ...p,
    // Hours earned from events + any admin adjustment.
    hours: (hoursByMember[p.id] ?? 0) + Number(p.hours_adjustment ?? 0),
    avatar: initials(p.name),
  }))
}

// Admin-only: update any member's profile (name, role, hours_adjustment, is_admin).
// Allowed by RLS only when the caller is an admin.
export function adminUpdateProfile(id, fields) {
  return supabase.from('profiles').update(fields).eq('id', id)
}

// Full detail for one member: profile + the events they signed up for + the
// to-dos they took responsibility for + their total hours.
export async function getProfileDetails(id) {
  const [{ data: profile }, { data: signups }, { data: todos }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', id).single(),
    supabase.from('event_signups').select('events ( id, name, date, location, raised, hours )').eq('member_id', id),
    supabase.from('event_todos').select('id, item, done, events ( id, name, date )').eq('assignee_id', id),
  ])
  const today = new Date().toISOString().slice(0, 10)
  const events = (signups ?? []).map((s) => s.events).filter(Boolean)
  const hours =
    events.filter((e) => e.date < today).reduce((sum, e) => sum + Number(e.hours), 0) +
    Number(profile?.hours_adjustment ?? 0)
  return {
    profile: profile ? { ...profile, avatar: initials(profile.name) } : null,
    events,
    todos: todos ?? [],
    hours,
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

// ---- Events --------------------------------------------------------------

// Events with their signups (incl. member names) and to-dos, newest first.
export async function getEvents() {
  const { data } = await supabase
    .from('events')
    .select(
      `*,
       event_signups ( member_id, profiles ( id, name ) ),
       event_todos ( id, item, done, assignee_id, profiles ( id, name ) )`,
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

// ---- helpers -------------------------------------------------------------

export function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}
