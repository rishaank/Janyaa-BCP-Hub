import { TrendingUp, AlertTriangle, Info, Sparkles } from 'lucide-react'
import { Card, Badge } from './ui'

// tone → icon + colours for an AI insight card.
export const toneMeta = {
  positive: { icon: TrendingUp, chip: 'green', iconBg: 'bg-green-50 text-green-600' },
  warning: { icon: AlertTriangle, chip: 'gold', iconBg: 'bg-gold-100 text-gold-700' },
  neutral: { icon: Info, chip: 'blue', iconBg: 'bg-blue-50 text-blue-600' },
}

// One AI insight as a card. The small Sparkles marks it as AI-generated. Shared by
// the AI Insights page and the Dashboard.
export default function InsightCard({ ins }) {
  const meta = toneMeta[ins.tone] ?? toneMeta.neutral
  const Icon = meta.icon
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-center justify-between gap-2">
        <span className={`grid h-10 w-10 place-items-center rounded-md ${meta.iconBg}`}>
          <Icon size={20} />
        </span>
        <div className="flex items-center gap-2">
          {ins.metric && <Badge tone={meta.chip}>{ins.metric}</Badge>}
          <Sparkles size={13} className="text-ink-300" aria-label="AI-generated" />
        </div>
      </div>
      <h3 className="mt-3 font-display text-h4 font-semibold text-ink-900">{ins.title}</h3>
      <p className="mt-1.5 flex-1 text-sm text-ink-600">{ins.detail}</p>
    </Card>
  )
}
