// A temporary password an admin can read out loud or send by text.
//
// Onboarding used to hang on a one-time link, and a link is fragile in ways a
// password isn't: it can be opened by a preview renderer, scanned by a mailbox,
// or simply expire while the member is in class. A password has no clock and no
// one-shot token — the member types it, then picks their own.
//
// The alphabet leaves out 0/O/1/l/I so nothing is ambiguous when it's read off
// a screen, and the groups make it easy to dictate.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateTempPassword(groups = 3, size = 4) {
  const bytes = new Uint32Array(groups * size)
  crypto.getRandomValues(bytes)
  const chars = [...bytes].map((n) => ALPHABET[n % ALPHABET.length])
  return Array.from({ length: groups }, (_, g) => chars.slice(g * size, g * size + size).join('')).join('-')
}
