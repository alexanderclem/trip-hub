import type { ReactNode } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'
import { Brand } from '@/ui/Brand'
import './website.css'
import './marketing.css'

/** Header and footer of the website's secondary pages (pricing, organizers), as on the landing page. */
export function WebsiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className="website">
      <a className="website-skip" href="#main-content">Skip to content</a>
      <div className="website-topbar">
        <header className="website-header website-container">
          <Link to="/" aria-label="Stowaway home"><Brand variant="website" className="website-logo" /></Link>
          <nav aria-label="Main navigation">
            <Link to="/operators" className="website-nav-detail">For organizers</Link>
            <Link to="/pricing" className="website-nav-detail">Pricing</Link>
            <Link to="/app" className="website-button website-button-outline">Open app <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </nav>
        </header>
      </div>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="website-footer website-container">
        <div><Link to="/" aria-label="Stowaway home"><Brand variant="website" className="website-logo" /></Link><p>A shared planner for group trips.</p></div>
        <nav aria-label="Footer navigation"><Link to="/operators">For organizers</Link><Link to="/pricing">Pricing</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/app">Open app</Link></nav>
      </footer>
    </div>
  )
}
