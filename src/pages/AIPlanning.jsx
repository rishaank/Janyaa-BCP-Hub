import { useEffect } from 'react'
import { PageHeader } from '../components/ui'
import { autoRefreshMonthlyAI } from '../lib/api'
import Insights from './Insights'
import AIStudio from './AIStudio'

// AI Insights + AI Studio combined into one tab: the insight feed, then event
// planning + suggestions, the assistant, and social studio — all from real club
// data, stacked on a single page. Every AI block here auto-refreshes monthly.
export default function AIPlanning() {
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
