import { useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { autoRefreshMonthlyAI } from '../lib/api'
import { useDocumentTitle } from '../lib/useDocumentTitle'
import Insights from './Insights'
import AIStudio from './AIStudio'

// AI Insights + AI Studio combined into one tab: the insight feed, then event
// planning + suggestions, the assistant, and social studio — all from real club
// data, stacked on a single page. Every AI block here auto-refreshes monthly.
export default function AIPlanning() {
  useDocumentTitle('AI Planning')
  // Monthly auto-refresh: regenerate stale (>30-day) insights + suggestions in
  // the background. Throttled by cache age, so a normal visit costs nothing.
  useEffect(() => {
    autoRefreshMonthlyAI()
  }, [])

  return (
    <>
      <PageHeader
        title="AI Planning"
        subtitle="Gemini-powered insights, planning, and content from your real club data — refreshed automatically every month."
      />
      {/* Mobile-only hero — mirrors the redesign's gradient banner. */}
      <div
        className="mb-5 rounded-[20px] p-[18px] text-white shadow-card lg:hidden"
        style={{ background: 'linear-gradient(120deg, var(--color-blue-800), var(--color-green-800))' }}
      >
        <span className="flex items-center gap-2 text-sm font-bold"><Sparkles size={17} /> Powered by Gemini</span>
        <p className="mt-2 text-[13px] leading-relaxed text-white/85">
          The Hub feeds your real attendance, hours, fundraising, and locations into Gemini to surface what’s working — refreshed monthly.
        </p>
      </div>
      {/* The whole page cascades in on load — Insights, planning, chat, social. */}
      <div className="ja-stagger">
        {/* Match the mb-8 rhythm of the AI Studio sections below. */}
        <section className="mb-8">
          <Insights embedded />
        </section>
        <AIStudio embedded />
      </div>
    </>
  )
}
