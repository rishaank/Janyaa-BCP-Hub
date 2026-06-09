import { UtensilsCrossed } from 'lucide-react'
import { PageHeader, EmptyState } from '../components/ui'

// Intentionally blank — the restaurant affiliate (spirit-night) program is future work.
export default function Restaurants() {
  return (
    <>
      <PageHeader title="Restaurant Affiliates" subtitle="Spirit-night fundraisers and dining partnerships that give back to the club." />
      <EmptyState icon={UtensilsCrossed} title="Coming soon">
        The restaurant affiliate program will live here. Nothing to show yet.
      </EmptyState>
    </>
  )
}
