import { Component } from 'react'

// Catches render-time crashes (and failed lazy-chunk loads after a redeploy)
// so one broken page never blanks the whole app.
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    // A dynamic import 404s when a deploy replaced the hashed chunks — a plain
    // reload picks up the new version.
    const stale = /dynamically imported module|module script failed|loading chunk/i.test(String(error))

    return (
      <div className="grid min-h-screen place-items-center bg-paper p-6 text-center">
        <div>
          <h1 className="font-display text-h2 font-bold text-ink-900">
            {stale ? 'Update available' : 'Something went wrong'}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
            {stale
              ? 'The Hub was updated since this tab loaded. Reload to get the newest version.'
              : 'An unexpected error broke this page. Reloading usually fixes it.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}
