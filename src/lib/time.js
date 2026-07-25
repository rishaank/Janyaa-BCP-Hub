// Club time is America/Los_Angeles — every event/meeting date + time is stored and
// shown in PST/PDT. These helpers compare against "now" in that zone as naive
// date/time strings, so there's no DST math on our side.
//
// `hasEnded` mirrors the server exactly (migrations 0030 + 0032):
//   (date + coalesce(end_time, '23:59')) at time zone 'America/Los_Angeles' <= now()
// so the UI flips an event/meeting to Past at the same instant the member's hours
// land. Never use a UTC date here — `new Date().toISOString()` is already tomorrow
// after 5 PM PDT, which used to move events to Past hours early.

export function laNow() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date()).map((x) => [x.type, x.value]),
  )
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${(p.hour === '24' ? '00' : p.hour)}:${p.minute}` }
}

// Today's date in club time, as 'YYYY-MM-DD'.
export const laToday = () => laNow().date

// Has this event/meeting finished? Undated (tentative) items never have.
export function hasEnded(item, now = laNow()) {
  if (!item?.date) return false
  if (item.date < now.date) return true
  if (item.date > now.date) return false
  const end = (item.end_time || '').slice(0, 5) || '23:59'
  return end <= now.time
}
