import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { bestDays } from '../lib/planning'

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0] // display Mon..Sun

// Average $ raised per weekday from past events. The top day is gold.
export default function BestDaysChart({ events }) {
  const all = bestDays(events)
  const data = MON_FIRST.map((i) => all[i])
  const max = Math.max(0, ...data.map((d) => d.avgRaised))

  if (!data.some((d) => d.count > 0)) {
    return <p className="py-8 text-center text-sm text-ink-400">Not enough past events yet to spot a pattern.</p>
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#8c8475' }} tickLine={false} axisLine={{ stroke: '#e7e1d7' }} />
          <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11, fill: '#8c8475' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            formatter={(v, _n, p) => [`$${v} avg · ${p.payload.count} event${p.payload.count === 1 ? '' : 's'}`, '']}
            labelStyle={{ color: '#2a2620', fontWeight: 600 }}
          />
          <Bar dataKey="avgRaised" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={max > 0 && d.avgRaised === max ? '#fba631' : '#cde3c4'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
