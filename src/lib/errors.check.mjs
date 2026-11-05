// Self-check for errorText(). No test runner in this repo: run `node src/lib/errors.check.mjs`.
// The point is the two directions, not coverage: raw server text must never reach
// a member, and a sentence written for the UI must come out byte-identical.
import assert from 'node:assert/strict'
import { errorText } from './errors.js'

const rewritten = [
  ['Gemini 503: { "error": { "code": 503, "message": "This model is currently experiencing high demand." } }', 'busy'],
  ['Gemini 429: {"error":{"status":"RESOURCE_EXHAUSTED"}}', 'free requests'],
  ['Gemini 400: bad request', 'had a problem'],
  ['TypeError: Failed to fetch', 'No connection'],
  ['new row violates row-level security policy for table "events"', "don't have access"],
  ['Invalid login credentials', 'email or password'],
  ['duplicate key value violates unique constraint "meetings_series_date_key"', 'already exists'],
  ['JWT expired', 'session expired'],
]
for (const [raw, fragment] of rewritten) {
  const out = errorText(raw)
  assert.ok(out.includes(fragment), `${raw} -> ${out}`)
  assert.ok(!out.includes('{'), `raw JSON leaked: ${out}`)
}

// Hand-written UI copy passes through untouched.
for (const msg of ['Pick at least one member.', 'Could not send your request.', 'That email already has an account.']) {
  assert.equal(errorText(msg), msg)
}

// Shapes that arrive instead of a string.
assert.equal(errorText(null), '')
assert.equal(errorText(''), '')
assert.equal(errorText(new Error('Could not approve the request.')), 'Could not approve the request.')
assert.equal(errorText({ error: 'Failed to fetch' }), 'No connection. Check your network and try again.')
assert.equal(errorText({}), 'Something went wrong. Try again.')
assert.equal(errorText('x'.repeat(200)), 'Something went wrong. Try again.')

console.log('errors.check.mjs: ok')
