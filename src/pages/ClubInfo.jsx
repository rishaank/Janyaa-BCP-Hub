import { useState } from 'react'
import {
  ExternalLink,
  FileText,
  Presentation,
  Video,
  ClipboardList,
  ShieldCheck,
  Link2,
  Image as ImageIcon,
  Copy,
  Check,
  QrCode,
  Download,
} from 'lucide-react'
import { PageHeader, Card, Button } from '../components/ui'

const docs = [
  { icon: Presentation, title: 'Club Charter', desc: 'Our founding charter', url: 'https://docs.google.com/presentation/d/1ZctOVnMEnfyzPMYBPjRTirzRFLAFUrHfAOLsB0deDRU/edit?usp=sharing' },
  { icon: FileText, title: 'Original Application Script', desc: 'The first club application script', url: 'https://docs.google.com/document/d/1ML922SiP7Sd5didK0K_O6f3VZ9XyUMJ9pYhdrNdjsZA/edit?usp=sharing' },
  { icon: FileText, title: '2026 Application Outline', desc: 'This year’s application outline', url: 'https://docs.google.com/document/d/1YCzkeIc6Z4d57VgzxtN_h9y7ADbYG1l58kUl-qeSBZE/edit?usp=sharing' },
]

const video2026 = [
  { label: 'Google Drive', url: 'https://drive.google.com/file/d/1fyzID3HnOwGJSA-tm_k4j9lB-OsbJoBc/view?usp=sharing' },
  { label: 'Instagram', url: 'https://www.instagram.com/p/DXmjXOFjqB0/' },
  { label: 'YouTube', url: 'https://youtube.com/shorts/NcV4zjSmMM8?feature=share' },
]

const forms = [
  { icon: ClipboardList, title: 'Membership Interest Form', desc: 'Start here to join the club', url: 'https://docs.google.com/forms/d/e/1FAIpQLSd0Zv4D3bD7nv1Qwl16yVfEdaMnrjJ0lb9nLsJmzHAOhABrWQ/viewform?usp=sharing', primary: true },
  { icon: ShieldCheck, title: 'Non-Disclosure Agreement', desc: 'Required member agreement', url: 'https://docs.google.com/forms/d/e/1FAIpQLScqExG0JoMCKU8Pm1epXzyPTi8y9CJil2oIZcioor8dbvQf_g/viewform' },
  { icon: ShieldCheck, title: 'Volunteer Code of Conduct', desc: 'Required member agreement', url: 'https://docs.google.com/forms/d/e/1FAIpQLSd1iVoHx3M6XLv-6RyF2j5IfzEzXIS28icLT7RTltzi6MM5EA/viewform' },
  { icon: ShieldCheck, title: 'Liability Release Waiver', desc: 'Required member agreement', url: 'https://docs.google.com/forms/d/e/1FAIpQLSfv-T_YJxwC1vZNYcVpNpiPcQ1rx1fF3uInDYCJ1GoZUE61-Q/viewform' },
]

const brand = [
  { icon: Link2, title: 'Linktree', desc: 'All our public links', url: 'https://linktr.ee/janyaabcp' },
  { icon: ImageIcon, title: 'Club Logo', desc: 'Official logo file', url: 'https://drive.google.com/file/d/1Jq-rz7ZJqtHUE3lY_0tsFSIMdcKj-fEo/view?usp=sharing' },
  { icon: ImageIcon, title: 'Posterboard', desc: 'Original club posterboard', url: 'https://drive.google.com/file/d/1_WrHCULyqJo6yr6YMC_HQQhXZyXWGMX3/view?usp=sharing' },
]

const stats = [
  { value: '800K+', label: 'students reached' },
  { value: '1,900', label: 'schools' },
  { value: '22,000', label: 'teachers trained' },
  { value: '98%+', label: 'of donations to the cause' },
]

const facts = [
  { text: 'Janyaa is a registered 501(c)(3) nonprofit (Tax ID 01-0922892) headquartered in Fremont, CA, focused on building creative problem-solving skills in rural children in India. "Janyaa" translates to "life." It was founded in 2009 by Venu Nadella.', source: 'janyaa.org', url: 'https://janyaa.org/' },
  { text: "Janyaa's core philosophy is experiential, hands-on STEM learning rather than lectures — based on the finding that people retain ~5% of a lecture, 50% of what they see and hear, and 80% of what they experience.", source: 'projectworldimpact.com', url: 'https://www.projectworldimpact.com/organization/janyaa-ca' },
  { text: 'Its flagship program is Janyaa Lab in a Box (JLIB): 600+ curriculum-aligned science and math experiments developed by Stanford professors, government teachers, and STEM experts, taught to children in grades 6–10.', source: 'millenniumpost.in', url: 'https://www.millenniumpost.in/opinion/nexus-of-good-driven-by-motivation-445803' },
  { text: "Janyaa's cumulative reach is large: 1,900 schools, 800,000 students, and 22,000 teachers.", source: 'janyaa.org', url: 'https://janyaa.org/' },
  { text: 'A 2015 ISB (Indian School of Business) evaluation found Janyaa students performed 50% better than non-Janyaa students.', source: 'janyaa.org', url: 'https://janyaa.org/janyaas-impact/' },
  { text: "A 2016 ASER pilot study showed a 52% improvement in student performance from using Janyaa's materials.", source: 'janyaa.org', url: 'https://janyaa.org/janyaas-impact/' },
  { text: 'A 2023–2024 evaluation showed a 65% improvement in Science and 57% in Maths.', source: 'janyaa.org', url: 'https://janyaa.org/janyaas-impact/' },
  { text: 'In the 2015 ISB study, 94% of students said they liked teachers showing the experiments and 92% wanted to practice them.', source: 'millenniumpost.in', url: 'https://www.millenniumpost.in/opinion/nexus-of-good-driven-by-motivation-445803' },
  { text: 'Janyaa launched its online Learning Hub in April 2020 to offset pandemic STEM learning losses; it enrolled 852 children across 65 schools in Telangana, while 1,126 public-school teachers received 52.6 hours of online STEM training between April 2020 and March 2021.', source: 'janyaa.org', url: 'https://janyaa.org/jlh/' },
  { text: 'More than 98% of donations go directly to the cause, and as a 501(c)(3) organization all donations are tax-deductible.', source: 'janyaafoundation.org', url: 'https://janyaafoundation.org/' },
  { text: 'Janyaa runs multiple Bay Area student-led youth chapters — including Almaden, Cupertino, and Palo Alto — that raise funds and awareness for STEM education for underprivileged kids in India.', source: 'janyaa.org', url: 'https://janyaa.org/janyaa-youth/' },
]

const cardTones = {
  green: 'bg-green-50 text-green-600',
  blue: 'bg-blue-50 text-blue-600',
  gold: 'bg-gold-100 text-gold-700',
}

function LinkCard({ icon: Icon, title, desc, url, tone = 'green' }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-start gap-3 rounded-xl border border-ink-200 bg-surface p-4 shadow-sm transition-colors hover:border-green-300"
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${cardTones[tone] ?? cardTones.green}`}>
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 font-semibold text-ink-900">
          <span className="truncate">{title}</span>
          <ExternalLink size={13} className="shrink-0 text-ink-300 transition-colors group-hover:text-green-600" />
        </span>
        {desc && <span className="mt-0.5 block text-sm text-ink-500">{desc}</span>}
      </span>
    </a>
  )
}

function Section({ title, hint, children }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-h4 font-semibold text-ink-900">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-ink-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function FactCard({ fact }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard?.writeText(`${fact.text} (Source: ${fact.url})`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <Card className="flex flex-col p-4">
      <p className="flex-1 text-sm leading-relaxed text-ink-700">{fact.text}</p>
      <div className="mt-3 flex items-center justify-between border-t border-ink-100 pt-2">
        <a
          href={fact.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          {fact.source} <ExternalLink size={11} />
        </a>
        <button
          onClick={copy}
          className="inline-flex items-center gap-1 text-xs text-ink-400 transition-colors hover:text-green-700"
          title="Copy the fact + source"
        >
          {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Cite'}
        </button>
      </div>
    </Card>
  )
}

// Linktree actions — open / copy the link, and open / copy / download the QR code.
function LinktreeCard() {
  const LINK = 'https://linktr.ee/janyaabcp'
  const QR = '/linktree-qr.png'
  const [copied, setCopied] = useState('')
  const flash = (k) => {
    setCopied(k)
    setTimeout(() => setCopied(''), 1500)
  }

  function copyLink() {
    navigator.clipboard?.writeText(LINK)
    flash('link')
  }
  async function copyQr() {
    try {
      const blob = await (await fetch(QR)).blob()
      await navigator.clipboard.write([new window.ClipboardItem({ [blob.type]: blob })])
      flash('qr')
    } catch {
      // Fall back to copying the image URL if image-to-clipboard isn't supported.
      navigator.clipboard?.writeText(`${window.location.origin}${QR}`)
      flash('qr')
    }
  }
  function downloadQr() {
    const a = document.createElement('a')
    a.href = QR
    a.download = 'janyaa-linktree-qr.png'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap gap-2">
        <a href={LINK} target="_blank" rel="noreferrer">
          <Button icon={ExternalLink}>Open Linktree</Button>
        </a>
        <Button variant="soft" icon={copied === 'link' ? Check : Copy} onClick={copyLink}>
          {copied === 'link' ? 'Copied' : 'Copy link'}
        </Button>
        <a href={QR} target="_blank" rel="noreferrer">
          <Button variant="soft" icon={QrCode}>Open QR code</Button>
        </a>
        <Button variant="soft" icon={copied === 'qr' ? Check : Copy} onClick={copyQr}>
          {copied === 'qr' ? 'Copied' : 'Copy QR code'}
        </Button>
        <Button variant="soft" icon={Download} onClick={downloadQr}>Download QR code</Button>
      </div>
    </Card>
  )
}

export default function ClubInfo() {
  return (
    <>
      <PageHeader
        title="Club Information"
        subtitle="Key links, forms, and Janyaa impact facts — all in one place."
        action={
          <a href="https://linktr.ee/janyaabcp" target="_blank" rel="noreferrer">
            <Button variant="soft" icon={Link2}>Linktree</Button>
          </a>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5 text-center">
            <p className="font-display text-3xl font-bold tabular-nums text-green-600">{s.value}</p>
            <p className="mt-1 text-xs text-ink-500">{s.label}</p>
          </Card>
        ))}
      </div>

      <Section title="Linktree" hint="All our public links in one place">
        <LinktreeCard />
      </Section>

      <Section title="Club documents" hint="The charter, plans, and applications.">
        <div className="grid gap-3 sm:grid-cols-2">
          {docs.map((d) => (
            <LinkCard key={d.title} {...d} />
          ))}
        </div>
      </Section>

      <Section title="2026 application video" hint="The same video across three platforms.">
        <Card className="flex flex-wrap items-center gap-3 p-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
            <Video size={18} />
          </span>
          <span className="font-semibold text-ink-900">Watch the 2026 application video</span>
          <span className="flex flex-wrap gap-2">
            {video2026.map((v) => (
              <a
                key={v.label}
                href={v.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-ink-200 px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                {v.label} <ExternalLink size={12} />
              </a>
            ))}
          </span>
        </Card>
      </Section>

      <Section title="Forms & agreements" hint="New members start with the interest form, then complete all three agreements.">
        <div className="grid gap-3 sm:grid-cols-2">
          {forms.map((f) => (
            <LinkCard key={f.title} {...f} tone={f.primary ? 'green' : 'blue'} />
          ))}
        </div>
      </Section>

      <Section title="Brand & links">
        <div className="grid gap-3 sm:grid-cols-3">
          {brand.map((b) => (
            <LinkCard key={b.title} {...b} tone="gold" />
          ))}
        </div>
      </Section>

      <Section title="Janyaa impact facts" hint="Cited, copy-ready facts about Janyaa's mission and results.">
        <div className="grid gap-3 sm:grid-cols-2">
          {facts.map((f, i) => (
            <FactCard key={i} fact={f} />
          ))}
        </div>
      </Section>
    </>
  )
}
