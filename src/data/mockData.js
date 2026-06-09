// Static reference data.
// Live data (members, events, hours, fundraising, locations, settings) comes from
// Supabase via src/lib/api.js. What remains here is just a couple of constants
// and the event-type metadata used by the Events page.

// Event type → label + badge color. Used by the Events page and create form.
export const eventTypes = [
  { id: 'evsfm', label: 'EVSFM Fundraiser', color: 'amber' },
  { id: 'vasona', label: 'Vasona Lemonade Stand', color: 'emerald' },
  { id: 'library', label: 'Library Session', color: 'indigo' },
  { id: 'sunday_friends', label: 'Sunday Friends', color: 'sky' },
  { id: 'st_andrews', label: "St. Andrew's", color: 'violet' },
  { id: 'restaurant_night', label: 'Restaurant Night', color: 'rose' },
  { id: 'other', label: 'Other', color: 'slate' },
]

// AI Insights is not built yet. These describe what the feature WILL surface once
// it's wired to the Claude API — shown as a labeled preview, never as real data.
export const plannedInsights = [
  'Best day & time to fundraise — which slots historically raise the most.',
  'Crew size vs. dollars raised — the staffing level that actually pays off.',
  'Members trending up or down on hours, and who to recognize this term.',
  'Which sites and neighborhoods convert best, so outreach focuses there.',
  'Pace to goal — a projected term total and whether you’re on track.',
  'Suggested next events, based on what has worked before.',
]
