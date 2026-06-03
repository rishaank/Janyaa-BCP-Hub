import LegalPage, { Section } from '../components/LegalPage'

const CONTACT = 'janyaabcp@gmail.com'

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="June 2026">
      <p className="text-sm leading-relaxed text-ink-600">
        These terms cover your use of the Janyaa BCP Hub (“the Hub”), the internal web app for the BCP
        chapter of the Janyaa Foundation. By using the Hub, you agree to them. If you don’t agree, please
        don’t use the Hub.
      </p>

      <Section title="Who can use the Hub">
        <p>
          Anyone may view the public dashboard. Everything else is for club members with an account, which
          is created by a club admin (invite-only). Accounts are personal to the named member.
        </p>
      </Section>

      <Section title="Your account">
        <p>
          Keep your password private and let a club lead know if you think your account has been accessed by
          someone else. You’re responsible for activity under your account. You can delete your account and
          data at any time from your profile page.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>misuse, disrupt, scrape, or try to gain unauthorized access to the Hub or its data;</li>
          <li>upload unlawful, harmful, or harassing content, or anyone else’s personal information without their permission;</li>
          <li>impersonate another person, or use the Hub for anything other than running the club.</li>
        </ul>
      </Section>

      <Section title="Content you upload">
        <p>
          You’re responsible for what you add (such as a profile photo or notes). Only upload content you
          have the right to share, and don’t upload a photo of anyone who hasn’t agreed to it. We may remove
          content or close accounts that break these terms.
        </p>
      </Section>

      <Section title="No warranty">
        <p>
          The Hub is a volunteer-run student club tool provided “as is”, without warranties of any kind. We
          don’t promise it will always be available, accurate, or error-free.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the fullest extent allowed by law, Janyaa BCP, its members and leaders, and the Janyaa
          Foundation are not liable for any indirect or incidental damages arising from your use of the Hub.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          We may suspend or remove accounts that violate these terms. You can delete your own account at any
          time, which ends these terms for you.
        </p>
      </Section>

      <Section title="Governing law">
        <p>These terms are governed by the laws of the State of California.</p>
      </Section>

      <Section title="Changes & contact">
        <p>
          We may update these terms and will post changes here with a new “Last updated” date. Questions?
          Email <a href={`mailto:${CONTACT}`} className="font-medium text-blue-600 hover:text-blue-700">{CONTACT}</a>.
        </p>
      </Section>
    </LegalPage>
  )
}
