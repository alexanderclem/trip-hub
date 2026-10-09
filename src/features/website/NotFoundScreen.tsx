import { Link } from 'react-router'
import { Brand } from '@/ui/Brand'
import './website.css'

/** Any address the app doesn't know. Trip links are matched earlier, so they never land here. */
export function NotFoundScreen() {
  return (
    <div className="website website-notfound">
      <div className="website-topbar">
        <header className="website-header website-container">
          <Link to="/" aria-label="Stowaway home"><Brand variant="website" className="website-logo" /></Link>
          <nav aria-label="Main navigation"><Link to="/app" className="website-button website-button-outline">Open app</Link></nav>
        </header>
      </div>
      <main className="website-container website-notfound-main">
        <img src="/brand/stowaway-mark.svg" alt="" width="96" height="96" />
        <h1>This page didn’t make the trip.</h1>
        <p>The link may be mistyped or out of date. If a friend sent you an invite, ask them to share it again from their trip.</p>
        <div className="website-actions">
          <Link to="/" className="website-button website-button-primary">Back to Stowaway</Link>
          <Link to="/app" className="website-text-link">Find your trips</Link>
        </div>
      </main>
    </div>
  )
}
