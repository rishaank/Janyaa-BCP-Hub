// Excel export of the hours breakdown (Feature 3). SheetJS is loaded lazily so it
// stays out of the main bundle until someone actually exports.

const SITE = 'https://janyaa-bcp-hub.vercel.app'

const kindLabel = {
  event: 'Event',
  meeting: 'Meeting',
  role_monthly: 'Role (monthly)',
  role_event: 'Role (per event)',
  manual: 'Manual',
  import: 'Logged',
}

// SheetJS tab names: max 31 chars, no \ / ? * [ ] :
const tabName = (n) => (n || 'Member').replace(/[\\/?*[\]:]/g, '').slice(0, 31) || 'Member'

function sheetForMember(XLSX, m) {
  const rows = (m.entries ?? []).map((e) => ({
    Date: e.date || 'Multiple / undated',
    Hours: Number(e.hours),
    Service: e.description,
    Type: kindLabel[e.kind] ?? e.kind,
    'Event link': e.event_id ? `${SITE}/events/${e.event_id}` : '',
  }))
  rows.push({ Date: '', Hours: '', Service: '', Type: '', 'Event link': '' })
  rows.push({ Date: '', Hours: Number(m.total), Service: 'TOTAL HOURS', Type: '', 'Event link': '' })
  const ws = XLSX.utils.json_to_sheet(rows, { header: ['Date', 'Hours', 'Service', 'Type', 'Event link'] })
  ws['!cols'] = [{ wch: 18 }, { wch: 8 }, { wch: 54 }, { wch: 16 }, { wch: 46 }]
  return ws
}

// One member → a single-sheet workbook.
export async function exportMemberHours(m) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheetForMember(XLSX, m), tabName(m.name))
  XLSX.writeFile(wb, `${m.name} - hours.xlsx`)
}

// All members → one workbook, a tab per member (mirrors the source format).
export async function exportAllHours(members) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  const used = new Set()
  for (const m of [...members].sort((a, b) => Number(b.total) - Number(a.total))) {
    let name = tabName(m.name)
    let i = 2
    while (used.has(name)) name = tabName(`${m.name} ${i++}`)
    used.add(name)
    XLSX.utils.book_append_sheet(wb, sheetForMember(XLSX, m), name)
  }
  XLSX.writeFile(wb, 'Janyaa Member Hours.xlsx')
}
