import { Link } from 'react-router-dom'
import { Sparkles, ArrowRight } from 'lucide-react'
import { Card } from './ui'
import { plannedInsights } from '../data/mockData'

// Dashboard teaser for AI Insights. Shows real Gemini insights when they exist,
// otherwise a labeled preview of what the feature will surface.
export default function AiInsightsCard({ compact = false, insights }) {
  const real = Array.isArray(insights) && insights.length > 0
  const items = real ? insights.slice(0, compact ? 3 : insights.length) : plannedInsights

  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-blue-700 to-green-700 p-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <h3 className="font-semibold">AI Insights</h3>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white ring-1 ring-white/25">
            {real ? 'Live · Gemini' : 'Coming soon'}
          </span>
        </div>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          {real
            ? 'Generated from your real events, hours, and fundraising:'
            : 'Open the Insights page and generate it — Gemini will surface things like:'}
        </p>
      </div>

      <ul className="divide-y divide-ink-100">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 px-5 py-3 text-sm">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-blue-400" />
            {real ? (
              <span className="text-ink-700">
                <span className="font-semibold text-ink-900">{item.title}.</span> {item.detail}
              </span>
            ) : (
              <span className="text-ink-600">{item}</span>
            )}
          </li>
        ))}
      </ul>

      <Link
        to="/insights"
        className="flex items-center justify-between px-5 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50"
      >
        {real ? 'See all insights' : 'Open AI Insights'}
        <ArrowRight size={15} />
      </Link>
    </Card>
  )
}
