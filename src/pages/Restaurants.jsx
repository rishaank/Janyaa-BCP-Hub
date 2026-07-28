import { UtensilsCrossed } from 'lucide-react'
import { PageHeader, EmptyState } from '../components/ui'
import { useDocumentTitle } from '../lib/useDocumentTitle'

// Intentionally blank — the restaurant affiliate (spirit-night) program is future work.
export default function Restaurants() {
  useDocumentTitle('Restaurant Affiliates')
  return (
    <>
      <PageHeader title="Restaurant Affiliates" />
      <EmptyState icon={UtensilsCrossed} title="Coming soon">
        The restaurant affiliate program will live here. Nothing to show yet.
      </EmptyState>
    </>
  )
}
