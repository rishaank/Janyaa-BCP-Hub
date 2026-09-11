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
  'Best day and time to fundraise, by past results.',
  'Crew size against dollars raised.',
  'Members trending up or down on hours.',
  'Which sites and neighborhoods raise the most.',
  'Pace to goal, with a projected term total.',
  'Next events worth running, based on past ones.',
]
