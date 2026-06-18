import { URL_RE, isUrl, splitTrailing, hrefFor } from '../lib/links'

// Renders text with any URLs turned into clickable links. Used wherever members
// type free text (meeting/event notes, location notes, goal text).
export default function Linkify({ children, className }) {
  const text = children == null ? '' : String(children)
  if (!text) return null
  const parts = text.split(URL_RE)
  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null
        if (isUrl(part)) {
          const { url, trail } = splitTrailing(part)
          return (
            <span key={i}>
              <a
                href={hrefFor(url)}
                target="_blank"
                rel="noreferrer"
                className={className || 'break-words font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 transition-colors hover:text-blue-700'}
              >
                {url}
              </a>
              {trail}
            </span>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}
