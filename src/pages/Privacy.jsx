import LegalPage, { Section } from '../components/LegalPage'

// Contact for privacy questions + data requests. Change this to a dedicated club
// address if you have one.
const CONTACT = 'kotian.house@gmail.com'

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="June 2026">
      <p className="text-sm leading-relaxed text-ink-600">
        This policy explains what the Janyaa BCP Hub (“the Hub”, “we”, “us”) collects, how we use it, and
        the choices you have. Janyaa BCP is a student-run STEM-education nonprofit — the BCP chapter of the
        Janyaa Foundation. Questions or requests? Email{' '}
        <a href={`mailto:${CONTACT}`} className="font-medium text-blue-600 hover:text-blue-700">{CONTACT}</a>.
      </p>

      <Section title="Information we collect">
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="font-medium text-ink-800">Account:</span> your name and email address (needed to have an account).</li>
          <li><span className="font-medium text-ink-800">Profile:</span> an optional profile photo and your club role.</li>
          <li><span className="font-medium text-ink-800">Club activity:</span> volunteer hours, event sign-ups, meeting attendance, to-do items you claim, and leadership goals.</li>
          <li><span className="font-medium text-ink-800">On your device:</span> your login session and interface preferences (such as light/dark theme) are stored in your browser. We do not use advertising or third-party analytics cookies.</li>
        </ul>
      </Section>

      <Section title="How we use it">
        <p>
          We use this information only to run the club: tracking volunteer hours and participation,
          coordinating events and meetings, managing fundraising, and producing summary insights for club
          leaders. We do not sell or rent your personal information to anyone.
        </p>
      </Section>

      <Section title="What is shown publicly">
        <p>
          The dashboard at the site’s home page can be viewed without signing in. It shows aggregate club
          statistics, fundraising totals, the volunteer-hours leaderboard (member names, optional profile
          photos, roles, and hours), active leadership goals, and AI-generated insights. <span className="font-medium text-ink-800">Everything
          else — the member directory, events, meetings, profiles, and more — requires signing in.</span> Please
          don’t upload a profile photo you wouldn’t want shown publicly.
        </p>
      </Section>

      <Section title="AI insights">
        <p>
          We use Google’s Gemini API to turn club activity into short written insights. We send only
          abbreviated names (first name and last initial), roles, and numeric statistics — never email
          addresses or full names. We never send anyone’s contact information to the AI.
        </p>
      </Section>

      <Section title="Cookies & local storage">
        <p>
          We store only what the Hub needs to work: a login session (essential) and your interface
          preferences (functional). We don’t use tracking, advertising, or third-party analytics cookies, so
          there’s no cookie-consent banner to click through.
        </p>
      </Section>

      <Section title="Service providers">
        <p>We rely on a few vendors that process data on our behalf to provide the Hub:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><span className="font-medium text-ink-800">Supabase</span> — database, authentication, and photo storage.</li>
          <li><span className="font-medium text-ink-800">Vercel</span> — website hosting.</li>
          <li><span className="font-medium text-ink-800">Google (Gemini API)</span> — generating AI insights from abbreviated, non-identifying data.</li>
        </ul>
      </Section>

      <Section title="Minors">
        <p>
          Our members are high-school students, and many are under 18. If you are a minor, you (or your
          parent or guardian) may ask us to remove content you posted, and you can delete your account and
          data yourself at any time (see “Your choices”). Accounts are invite-only and created for club
          members; we don’t knowingly collect information from children under 13. If you believe a child
          under 13 has an account, contact us and we’ll remove it.
        </p>
      </Section>

      <Section title="Your choices & rights">
        <ul className="list-disc space-y-1 pl-5">
          <li>Review and update your profile any time after signing in.</li>
          <li>Add or remove your profile photo from your profile page.</li>
          <li>
            <span className="font-medium text-ink-800">Delete your account and data yourself</span> — go to your profile and choose
            “Delete my account”. This permanently removes your profile, photo, sign-ups, and attendance.
          </li>
          <li>Or email <a href={`mailto:${CONTACT}`} className="font-medium text-blue-600 hover:text-blue-700">{CONTACT}</a> and we’ll handle any access or deletion request.</li>
        </ul>
      </Section>

      <Section title="Data retention & security">
        <p>
          We keep your information while you’re a club member; deleting your account removes it. Data is
          protected with database access controls and encryption in transit. No online service is perfectly
          secure, but we limit access to club members and admins.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We’ll post any changes here and update the “Last updated” date above. Significant changes will be
          shared with club members.
        </p>
      </Section>
    </LegalPage>
  )
}
