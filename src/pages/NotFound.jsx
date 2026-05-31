import { Link } from 'react-router-dom'
import { Logo } from '../components/ui'

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6 text-center">
      <div>
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <p className="text-6xl font-bold tracking-tight text-indigo-600">404</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-1 text-sm text-slate-500">That page doesn't exist (yet).</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  )
}
