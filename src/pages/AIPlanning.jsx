import { PageHeader } from '../components/ui'
import Insights from './Insights'
import AIStudio from './AIStudio'

// AI Insights + AI Studio combined into one tab: the insight feed, then the
// planner, "what to run next" suggestions, and social studio — all from real
// club data, stacked on a single page.
export default function AIPlanning() {
  return (
    <>
      <PageHeader
        title="AI Planning"
        subtitle="Gemini-powered insights, event planning, and content ideas from your real club data."
      />
      <Insights embedded />
      <AIStudio embedded />
    </>
  )
}
