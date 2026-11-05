// One place that turns whatever a backend hands back into a sentence a member
// can act on. The AI Edge Functions pass Gemini's raw body straight through
// (`Gemini 503: {"error":{"code":503,…}}`), Postgres passes RLS and constraint
// text, and a dropped connection throws "Failed to fetch". None of that is UI
// copy, and a member who sees it has no idea whether to retry or give up.
//
// Rewriting happens here, not at each call site: every screen renders errors
// through <ErrorNote> (components/ui.jsx), which runs this on any string it is
// given. Readable text passes through untouched, so a hand-written message like
// "Pick at least one member." stays exactly as written.

const RULES = [
  // Gemini, via any of the ai-* functions. 429 = free-tier quota, 5xx = their side.
  [/\bGemini 429\b|RESOURCE_EXHAUSTED|\bquota\b/i, 'The AI is out of free requests. Try again in a few minutes.'],
  [/\bGemini 5\d\d\b|UNAVAILABLE|overloaded|high demand/i, 'The AI service is busy. Try again in a minute.'],
  [/\bGemini \d\d\d\b/i, 'The AI service had a problem. Try again.'],
  [/GEMINI_API_KEY|not set up/i, 'AI is not set up yet. Ask a club lead.'],

  // Network / the browser never reached us.
  [/failed to fetch|networkerror|load failed|err_internet|offline/i, 'No connection. Check your network and try again.'],
  [/timeout|timed out|aborted/i, 'That took too long. Try again.'],

  // Postgres + Supabase auth.
  [/row-level security|permission denied|not authori[sz]ed|insufficient privilege/i, "You don't have access to do that."],
  [/jwt expired|invalid jwt|session.*expired|refresh token/i, 'Your session expired. Sign in again.'],
  [/invalid login credentials/i, 'That email or password is wrong.'],
  [/user already registered|already been registered/i, 'That email already has an account.'],
  [/duplicate key|unique constraint/i, 'That already exists.'],
  [/violates foreign key|still referenced/i, "Something else is still linked to that. Remove it first."],
]

// Raw server text leaks through as JSON blobs or stack-length strings.
const looksRaw = (s) => /[{}[\]]|^\w+Error:|\bat \w+\./.test(s) || s.length > 160

export function errorText(input) {
  if (!input) return ''
  const raw = String(
    typeof input === 'string' ? input : input.message ?? input.error ?? input.error_description ?? input,
  ).trim()
  if (!raw || raw === '[object Object]') return 'Something went wrong. Try again.'

  const hit = RULES.find(([re]) => re.test(raw))
  if (hit) return hit[1]
  return looksRaw(raw) ? 'Something went wrong. Try again.' : raw
}

export default errorText
