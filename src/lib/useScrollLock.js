import { useEffect } from 'react'

// Freeze the page behind a modal / sheet while it's open.
//
// The actual `overflow: hidden` lives in index.css under `html.ja-scroll-locked`
// (the app scrolls the document on desktop but `.jh-body` inside the mobile
// shell, so CSS handles both scrollers); this hook only owns the class and the
// scrollbar measurement.
//
// Refcounted at module scope because overlays stack — the mobile account sheet
// can open the custom-theme modal over itself, and closing the inner one must
// not unlock the page while the outer one is still up.
let locks = 0

export default function useScrollLock(active = true) {
  useEffect(() => {
    if (!active) return
    const html = document.documentElement
    if (++locks === 1) {
      // Measure the scrollbar we're about to hide so the page underneath
      // doesn't jump sideways as the veil fades in.
      html.style.setProperty('--ja-scrollbar-gap', `${window.innerWidth - html.clientWidth}px`)
      html.classList.add('ja-scroll-locked')
    }
    return () => {
      if (--locks === 0) {
        html.classList.remove('ja-scroll-locked')
        html.style.removeProperty('--ja-scrollbar-gap')
      }
    }
  }, [active])
}
