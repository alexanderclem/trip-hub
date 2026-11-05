import { AppearancePicker } from '@/ui/AppearancePicker'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Menu, X } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { Brand } from '@/ui/Brand'
import { Barcode } from './tag/parts'
import './website.css'
import './marketing.css'
import './tag.css'

const links = [
  { to: '/how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/operators', label: 'For organizers' },
  { to: '/help', label: 'Help' },
]

/** The tag's top and bottom edges: header and footer for every public page. */
export function WebsiteFrame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const menu = useRef<HTMLButtonElement>(null)
  useEffect(() => { setOpen(false) }, [pathname])
  return (
    <div className="website tag-world">
      <a className="website-skip" href="#main-content">Skip to content</a>
      <div className="tag-top" onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); menu.current?.focus() } }}>
        <header className="tag-shell tag-header">
          <Link to="/" aria-label="Stowaway home" className="tag-home"><Brand className="tag-brand" /></Link>
          <nav aria-label="Main navigation" className="tag-nav">
            {links.map(({ to, label }) => <Link key={to} to={to} className="tag-nav-link" aria-current={pathname === to ? 'page' : undefined}>{label}</Link>)}
            <Link to="/app" className="tag-nav-link is-app">Open app</Link>
            <button ref={menu} type="button" className="tag-menu" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="website-mobile-nav" onClick={() => setOpen((value) => !value)}>{open ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}</button>
          </nav>
        </header>
        <nav id="website-mobile-nav" aria-label="Website pages" className="tag-shell tag-mobile-nav" hidden={!open} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); menu.current?.focus() } }}>
          {links.map(({ to, label }) => <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined} onClick={() => setOpen(false)}>{label}</Link>)}
          <Link to="/app#join" onClick={() => setOpen(false)}>Join a trip</Link>
          <Link to="/app" onClick={() => setOpen(false)}>Open app</Link>
        </nav>
      </div>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="tag-foot">
        <div className="tag-shell tag-foot-inner">
          <div className="tag-foot-brand">
            <Link to="/" aria-label="Stowaway home" className="tag-home"><Brand className="tag-brand" /></Link>
            <p>The whole trip, tucked away.</p>
          </div>
          <nav aria-label="Footer navigation" className="tag-foot-nav">
            <Link to="/how-it-works">How it works</Link><Link to="/pricing">Pricing</Link><Link to="/operators">For organizers</Link><Link to="/help">Help & contact</Link>
            <Link to="/help#about">About</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/app">Open app</Link>
          </nav>
          <div className="tag-foot-meta">
            <AppearancePicker />
            <div className="tag-foot-code" aria-hidden="true"><Barcode value="JOINSTOWAWAY.APP" /><span>joinstowaway.app</span></div>
          </div>
        </div>
      </footer>
    </div>
  )
}
