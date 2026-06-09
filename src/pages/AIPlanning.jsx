import { useSearchParams } from 'react-router-dom'
import { Sparkles, Wand2 } from 'lucide-react'
import { PageHeader } from '../components/ui'
import Insights from './Insights'
import AIStudio from './AIStudio'

const segBtn = (active) =>
  `flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? 'bg-green-600 text-white shadow-xs' : 'text-ink-600 hover:text-ink-900'
  }`

// AI Insights + AI Studio merged into one tab. A toggle switches between the
// insight feed and the planner/suggestions/social studio. `?tab=studio` deep-links.
export default function AIPlanning() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'studio' ? 'studio' : 'insights'
  const setTab = (t) => setParams(t === 'studio' ? { tab: 'studio' } : {}, { replace: true })

  return (
    <>
      <PageHeader
        title="AI Planning"
        subtitle="Gemini-powered insights, event planning, and content ideas from your real club data."
        action={
          <div className="inline-flex rounded-lg border border-ink-200 bg-surface p-0.5">
            <button onClick={() => setTab('insights')} className={segBtn(tab === 'insights')}>
              <Sparkles size={15} /> Insights
            </button>
            <button onClick={() => setTab('studio')} className={segBtn(tab === 'studio')}>
              <Wand2 size={15} /> Studio
            </button>
          </div>
        }
      />
      {tab === 'insights' ? <Insights embedded /> : <AIStudio embedded />}
    </>
  )
}
