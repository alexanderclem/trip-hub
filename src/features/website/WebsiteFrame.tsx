import { AppearancePicker } from '@/ui/AppearancePicker'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUpRight, Menu, X } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { Brand } from '@/ui/Brand'
import './website.css'
import './marketing.css'

/** Header and footer of the website's secondary pages (pricing, organizers), as on the landing page. */
export function WebsiteFrame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const menu = useRef<HTMLButtonElement>(null)
  useEffect(() => { setOpen(false) }, [pathname])
  const links = [
    { to: '/how-it-works', label: 'How it works' },
    { to: '/operators', label: 'For operators' },
    { to: '/pricing', label: 'Pricing' },
    { to: '/help', label: 'Help' },
  ]
  return (
    <div className="website">
      <a className="website-skip" href="#main-content">Skip to content</a>
      <div className="website-topbar" onKeyDown={(event) => { if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); menu.current?.focus() } }}>
        <header className="website-header website-container">
          <Link to="/" aria-label="Stowaway home"><Brand variant="website" className="website-logo" /></Link>
          <nav aria-label="Main navigation">
            {links.map(({ to, label }) => <Link key={to} to={to} className="website-desktop-link" aria-current={pathname === to ? 'page' : undefined}>{label}</Link>)}
            <Link to="/app" className="website-button website-button-outline">Open app <ArrowUpRight size={16} aria-hidden="true" /></Link>
            <button ref={menu} type="button" className="website-menu-trigger" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="website-mobile-nav" onClick={() => setOpen((value) => !value)}>{open ? <X aria-hidden="true" size={21} /> : <Menu aria-hidden="true" size={21} />}</button>
          </nav>
        </header>
        <nav id="website-mobile-nav" aria-label="Website pages" className="website-mobile-nav website-container" hidden={!open} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); menu.current?.focus() } }}>
          {links.map(({ to, label }) => <Link key={to} to={to} aria-current={pathname === to ? 'page' : undefined} onClick={() => setOpen(false)}>{label}<ArrowUpRight aria-hidden="true" size={16} /></Link>)}
          <Link to="/app#join" onClick={() => setOpen(false)}>Join a trip</Link>
        </nav>
      </div>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="website-footer website-container"><AppearancePicker />
        <div><Link to="/" aria-label="Stowaway home"><Brand variant="website" className="website-logo" /></Link><p>Plan together. Keep the whole trip close.</p></div>
        <nav aria-label="Footer navigation"><Link to="/how-it-works">How it works</Link><Link to="/operators">For operators</Link><Link to="/pricing">Pricing</Link><Link to="/help">Help & contact</Link><Link to="/help#about">About</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/app">Open app</Link></nav>
      </footer>
    </div>
  )
}
