import { useCallback, useRef } from 'react'
import { useToast } from '../context/ToastContext'

// Draft rescue for multi-field popups (add/edit event, meeting, hours, goal,
// member, location, term…). Closing one of those with the X, the Cancel button,
// or a click on the veil used to bin everything typed so far with no warning.
//
// Wrap the modal's close and the form's state stops being disposable: if the
// fields differ from what they held when the modal opened, closing shows a
// "… draft cleared" chip for 7 seconds with an Undo that reopens the popup with
// every field exactly as it was. The draft itself never moves — the form modals
// stay mounted while closed, so Undo only has to reopen and skip the reset.
//
// Undo calls `reopen(draft)`: modals that stay mounted while closed (most of
// them) can ignore the argument, since their own state still holds the draft; a
// modal the parent unmounts on close hands it back so the parent can seed it.
//
// Usage inside a modal component:
//   const rescue = useDraftRescue({ label: 'Event', value: form, onClose, reopen })
//   useEffect(() => {
//     if (!open) return                     // the draft has to outlive the close
//     if (rescue.consumeRestore()) return   // Undo — leave the draft alone
//     const next = event ? {...} : blank
//     setForm(next)
//     rescue.setBaseline(next)              // what "unchanged" means from here
//   }, [event, open])
//   <Modal onClose={rescue.close} …>   … <Button onClick={rescue.close}>Cancel</Button>
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export function useDraftRescue({ label, value, baseline, onClose, reopen, enabled = true }) {
  const { showToast } = useToast()
  const valueRef = useRef(value)
  valueRef.current = value
  // What "unchanged" means. Modals that unmount on close pass `baseline` up
  // front (their first render may already be showing a rescued draft); the rest
  // stamp it with setBaseline each time they refill the form.
  const baselineRef = useRef(baseline ?? value)
  const restoringRef = useRef(false)

  // Called by the modal right after it (re)fills the form: this is the state the
  // draft is measured against, so an untouched edit form never looks dirty.
  const setBaseline = useCallback((next) => {
    baselineRef.current = next
  }, [])

  // True exactly once after Undo, so the modal's reset effect can bail out and
  // leave the rescued draft on screen.
  const consumeRestore = useCallback(() => {
    const restoring = restoringRef.current
    restoringRef.current = false
    return restoring
  }, [])

  const close = useCallback(() => {
    const dirty = enabled && !same(valueRef.current, baselineRef.current)
    onClose()
    if (!dirty) return
    showToast({
      message: `${label} draft cleared`,
      detail: 'Nothing was saved.',
      actionLabel: 'Undo',
      onAction: () => {
        restoringRef.current = true
        reopen(valueRef.current)
      },
    })
  }, [enabled, label, onClose, reopen, showToast])

  return { close, setBaseline, consumeRestore }
}
