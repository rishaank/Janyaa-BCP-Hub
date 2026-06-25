import { useEffect } from 'react'

// Base name shown in the browser tab / share-link preview. Each screen appends a
// relevant suffix (e.g. "Janyaa BCP Hub | Fundraising"); a falsy title — usually
// while a dynamic page's data loads — leaves just the base. Kept in sync with the
// static <title> in index.html and the mobile app-bar name.
const BASE = 'Janyaa BCP Hub'

// Sets document.title to "Janyaa BCP Hub | <title>" for the current screen. Call it
// from a page with whatever best describes what's on screen — a static label for
// fixed pages, or the loaded record's name for detail views.
//
// Note: this updates the live tab title (and the title some apps read when you
// share the link from an open page). It does NOT change server-rendered link
// previews (Open Graph), since this is a client-only SPA — those come from the
// static <meta> tags in index.html.
export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${BASE} | ${title}` : BASE
  }, [title])
}
