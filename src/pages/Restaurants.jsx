import { UtensilsCrossed } from 'lucide-react'
import { PageHeader, EmptyState } from '../components/ui'

// Intentionally blank — the restaurant spirit-night program is future work.
export default function Restaurants() {
  return (
    <>
      <PageHeader title="Restaurants" subtitle="Spirit-night restaurant fundraisers." />
      <EmptyState icon={UtensilsCrossed} title="Coming soon">
        The restaurant fundraiser program will live here. Nothing to show yet.
      </EmptyState>
    </>
  )
}
