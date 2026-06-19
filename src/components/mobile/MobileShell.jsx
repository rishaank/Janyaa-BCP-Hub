import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { CircleUserRound } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { initials } from '../../lib/api'
import { Avatar, roleTones } from '../ui'
import BottomTabs from './BottomTabs'
import MoreSheet from './MoreSheet'
import AccountSheet from './AccountSheet'

// The mobile app shell (below `lg`): app bar + scrollable page body + pill tab bar,
// with the "More" grid sheet and the account sheet layered over it. Replaces the
// desktop sidebar + top bar on phones.
export default function MobileShell() {
  const location = useLocation()
  const { session, profile, user } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const [acctOpen, setAcctOpen] = useState(false)

  // Any navigation closes the open sheets.
  useEffect(() => {
    setMoreOpen(false)
    setAcctOpen(false)
  }, [location.pathname, location.search])

  const name = profile?.name || user?.email?.split('@')[0] || ''

  return (
    <div className="jh-app">
      <header className="jh-appbar">
        <img src="/janyaa-logo.png" alt="" />
        <span className="jh-appbar-title">Janyaa BCP Hub</span>
        <span style={{ flex: 1 }} />
        <button className="jh-iconbtn" onClick={() => setAcctOpen(true)} aria-label="Account">
          {session ? (
            <Avatar size="sm" initials={initials(name)} tone={roleTones[profile?.role] ?? 'blue'} src={profile?.avatar_url} />
          ) : (
            <CircleUserRound size={23} />
          )}
        </button>
      </header>

      <main className="jh-body">
        <div className="jh-scroll ja-fade-soft" key={location.pathname}>
          <Outlet />
        </div>
      </main>

      <BottomTabs moreOpen={moreOpen} onMore={() => setMoreOpen((o) => !o)} />

      {moreOpen && <MoreSheet onClose={() => setMoreOpen(false)} />}
      {acctOpen && <AccountSheet onClose={() => setAcctOpen(false)} />}
    </div>
  )
}
