// Number formatting for anything that reaches the screen.
//
// Hours are derived, not typed: a 50-minute meeting is 0.8333333333333333 hours,
// and a term total made of those lands on a tail of digits nobody wants to read.
// Every number the UI prints goes through here, so it is rounded to at most two
// decimals (the hundredths place) with thousands separators — and, because the
// cap is a *maximum*, whole numbers stay whole: 3 → "3", 3.5 → "3.5",
// 0.8333333 → "0.83", 1250 → "1,250".
//
// This is display only. Stored values keep their full precision, so totals are
// still summed from the exact figures rather than from rounded ones.
export function num(value, max = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-US', { maximumFractionDigits: max })
}

// Money, same rounding: "$1,250" / "$1,250.75".
export function money(value, max = 2) {
  const n = Number(value)
  const sign = n < 0 ? '-' : ''
  return `${sign}$${num(Math.abs(n), max)}`
}
