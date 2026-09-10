// Transient bottom-of-screen chips ("toasts") — the app's one lightweight way to
// say something happened without stealing focus. Built for the draft-rescue chip
// (src/lib/useDraftRescue.js): closing a half-filled modal says so and offers Undo.
//
// Layer scale (see the Modal comment in components/ui.jsx): page content 0 ·
// sticky page headers 30 · desktop sidebar 40 · mobile bottom sheet 60/61 ·
// modals 200 · toasts 300. Toasts sit above modals on purpose — an Undo chip
// has to stay reachable even if the member opens another popup meanwhile.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Undo2 } from 'lucide-react'

const ToastContext = createContext({ showToast: () => {}, dismissToast: () => {} })

// Default life of a toast. The draft chip keeps this 7s window so there's time
// to notice it and hit Undo.
const DEFAULT_MS = 7000

let seq = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismissToast = useCallback((id) => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    ({ message, detail, actionLabel, onAction, duration = DEFAULT_MS, tone = 'ink' }) => {
      const id = ++seq
      // Keep at most three on screen — older ones drop off the top.
      setToasts((list) => [...list.slice(-2), { id, message, detail, actionLabel, onAction, duration, tone }])
      timers.current.set(id, setTimeout(() => dismissToast(id), duration))
      return id
    },
    [dismissToast],
  )

  // Never leave a timer running past unmount (a signed-out session, a hot reload).
  useEffect(() => {
    const running = timers.current
    return () => {
      running.forEach(clearTimeout)
      running.clear()
    }
  }, [])

  const value = useMemo(() => ({ showToast, dismissToast }), [showToast, dismissToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          className="pointer-events-none fixed bottom-[calc(150px+env(safe-area-inset-bottom))] left-1/2 z-[300] flex w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 flex-col items-stretch gap-2 lg:bottom-6 lg:left-auto lg:right-6 lg:translate-x-0"
          role="status"
          aria-live="polite"
        >
          {toasts.map((t) => (
            <Toast key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

function Toast({ toast, onDismiss }) {
  const { message, detail, actionLabel, onAction, duration, tone } = toast
  return (
    <div className="ja-pop pointer-events-auto overflow-hidden rounded-xl border border-ink-200 bg-surface shadow-lg">
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink-900">{message}</p>
          {detail && <p className="mt-0.5 truncate text-xs text-ink-500">{detail}</p>}
        </div>
        {actionLabel && (
          <button
            type="button"
            onClick={() => {
              onDismiss()
              onAction?.()
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
          >
            <Undo2 size={13} /> {actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
          aria-label="Dismiss"
        >
          <X size={15} />
        </button>
      </div>
      {/* Countdown rail — shows how long the Undo stays available. */}
      <div className="h-0.5 w-full bg-ink-100">
        <div
          className={`ja-toast-timer h-full ${tone === 'green' ? 'bg-green-500' : 'bg-gold-500'}`}
          style={{ animationDuration: `${duration}ms` }}
        />
      </div>
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
