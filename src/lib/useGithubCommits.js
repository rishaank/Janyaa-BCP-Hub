import { useEffect, useState } from 'react'

const REPO = 'rishaank/Janyaa-BCP-Hub'
const CACHE_KEY = 'janyaa-gh-commits'
const TTL = 30 * 60 * 1000 // 30 min — keeps the whole club well under GitHub's 60/hr unauth limit

// Recent commits to the repo, surfaced as "website updates" in the History page
// and the What's-new bell. Cached in localStorage so page views don't re-fetch.
// Requires the repo to be public (unauthenticated GitHub API).
export function useGithubCommits(limit = 30) {
  const [commits, setCommits] = useState(() => readCache() ?? [])
  const [loading, setLoading] = useState(() => !readCache())

  useEffect(() => {
    const cached = readCache()
    if (cached) {
      setCommits(cached)
      setLoading(false)
      return
    }
    let alive = true
    fetch(`https://api.github.com/repos/${REPO}/commits?per_page=${limit}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!alive) return
        const list = (Array.isArray(data) ? data : []).map((c) => ({
          sha: c.sha,
          message: (c.commit?.message ?? '').split('\n')[0],
          date: c.commit?.author?.date ?? c.commit?.committer?.date,
          url: c.html_url,
        }))
        if (list.length) writeCache(list) // never cache an empty/failed result
        setCommits(list)
        setLoading(false)
      })
      .catch(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [limit])

  return { commits, loading }
}

// Only a non-empty, fresh list counts as a cache hit — so a failed fetch (e.g.
// while the repo was still private) never poisons the feed, and it self-heals
// the moment the repo becomes reachable.
function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (raw && Date.now() - raw.at < TTL && Array.isArray(raw.list) && raw.list.length) return raw.list
  } catch {
    /* ignore */
  }
  return null
}
function writeCache(list) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), list }))
  } catch {
    /* ignore */
  }
}
