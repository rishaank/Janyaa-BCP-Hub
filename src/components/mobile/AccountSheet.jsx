import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { X, ChevronRight, LogOut, LogIn, Sun, Moon, Monitor, Palette } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { initials } from '../../lib/api'
import { Avatar, roleLabels, roleTones } from '../ui'
import CustomThemeModal from '../CustomThemeModal'

const THEMES = [['light', Sun], ['dark', Moon], ['system', Monitor], ['custom', Palette]]

export default function AccountSheet({ onClose }) {
  const { session, user, profile, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const [themeModal, setThemeModal] = useState(false)
  // Play the slide-down animation, then actually unmount when it ends.
  const [closing, setClosing] = useState(false)
  const requestClose = () => setClosing(true)

  const name = profile?.name || user?.email?.split('@')[0] || 'Member'
  const role = roleLabels[profile?.role] || 'Member'
  // Guests can't set a per-user image theme — they get the three base modes.
  const themeOptions = session ? THEMES : THEMES.filter(([v]) => v !== 'custom')

  return createPortal(
    <>
      <div className={'sheet-scrim' + (closing ? ' sheet-scrim-closing' : '')} onClick={requestClose} />
      <div
        className={'sheet' + (closing ? ' sheet-closing' : '')}
        role="dialog"
        aria-label="Account"
        onAnimationEnd={(e) => { if (closing && e.target === e.currentTarget) onClose() }}
      >
        <div className="sheet-title-row">
          <span className="sheet-title">Account</span>
          <button className="sheet-x" onClick={requestClose} aria-label="Close"><X size={18} /></button>
        </div>

        {session ? (
          <Link to={`/members/${user?.id}`} className="more-profile" onClick={onClose}>
            <Avatar initials={initials(name)} tone={roleTones[profile?.role] ?? 'blue'} src={profile?.avatar_url} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 700, fontSize: 15, color: 'var(--ink-900)' }}>{name}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--ink-500)' }}>{role} · View profile</span>
            </span>
            <ChevronRight size={18} className="more-chev" />
          </Link>
        ) : (
          <Link to="/login" className="jh-btn-primary" onClick={onClose} style={{ marginBottom: 16 }}>
            <LogIn size={17} /> Sign in
          </Link>
        )}

        <div className="more-group" style={{ paddingTop: 4 }}>Theme</div>
        <div className="jh-theme-row">
          {themeOptions.map(([val, Icon]) => (
            <button
              key={val}
              className={'jh-theme-btn' + (theme === val ? ' on' : '')}
              aria-label={val}
              onClick={() => {
                if (val === 'custom') { onClose(); setThemeModal(true) }
                else setTheme(val)
              }}
            >
              <Icon size={17} />
            </button>
          ))}
        </div>

        {session && (
          <button className="more-row more-row-solo" style={{ marginTop: 16 }} onClick={() => { onClose(); signOut() }}>
            <span className="more-row-ic" style={{ background: 'var(--coral-soft)', color: 'var(--coral-500)' }}><LogOut size={19} /></span>
            <span className="more-row-lab" style={{ color: 'var(--coral-500)' }}>Sign out</span>
          </button>
        )}

        <div className="sheet-foot">
          <Link to="/privacy" onClick={onClose}>Privacy</Link>
          <span aria-hidden>·</span>
          <Link to="/terms" onClick={onClose}>Terms</Link>
        </div>
      </div>

      <CustomThemeModal open={themeModal} onClose={() => setThemeModal(false)} />
    </>,
    document.body,
  )
}
