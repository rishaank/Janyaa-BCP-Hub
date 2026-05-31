import { PageHeader } from '../components/ui'
import AiInsightsCard from '../components/AiInsightsCard'

// Placeholder page: no real analysis yet — just a labeled preview of what's planned.
export default function Insights() {
  return (
    <>
      <PageHeader title="AI Insights" subtitle="A preview of what Claude will surface here — not yet implemented." />
      <AiInsightsCard />
    </>
  )
}
