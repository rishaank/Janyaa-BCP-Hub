import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight } from 'lucide-react'
import { Card } from './ui'
import { plannedInsights } from '../data/mockData'

// A clearly-labeled preview of the (not-yet-built) AI Insights feature.
// `compact` is the dashboard teaser; full is the Insights page.
export default function AiInsightsCard({ compact = false }) {
  const items = compact ? plannedInsights.slice(0, 3) : plannedInsights

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 p-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <h3 className="font-semibold">AI Insights</h3>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white ring-1 ring-white/25">
            Coming soon
          </span>
        </div>
        <p className="mt-2 max-w-xl text-sm text-violet-100">
          Boilerplate preview — not wired up yet. Once built, the Hub will feed your real
          events, hours, and fundraising into the Claude API and surface things like:
        </p>
      </div>

      <ul className="divide-y divide-slate-100">
        {items.map((text, i) => (
          <li key={i} className="flex items-start gap-3 px-5 py-3 text-sm text-slate-600">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-violet-400" />
            {text}
          </li>
        ))}
      </ul>

      {compact && (
        <Link
          to="/insights"
          className="flex items-center justify-between px-5 py-3 text-sm font-medium text-violet-600 hover:bg-violet-50"
        >
          See all planned insights
          <ArrowRight size={15} />
        </Link>
      )}
    </Card>
  )
}
