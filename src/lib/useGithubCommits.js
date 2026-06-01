import { useEffect, useState } from 'react'

const REPO = 'rishaank/Janyaa-BCP-Hub'
const CACHE_KEY = 'janyaa-gh-commits'
const TTL = 15 * 60 * 1000 // 15 min — stay under GitHub's 60/hr unauth limit

// Recent commits to the repo, surfaced as "website updates" in the History page
// and the What's-new bell. Cached in localStorage so page views don't re-fetch.
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
        writeCache(list)
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

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (raw && Date.now() - raw.at < TTL && Array.isArray(raw.list)) return raw.list
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
