import { Link } from 'react-router'
import { WebsiteFrame } from './WebsiteFrame'
import { TagHead } from './tag/parts'

/** Any address the app doesn't know. Trip links are matched earlier, so they never land here. */
export function NotFoundScreen() {
  return (
    <WebsiteFrame>
      <TagHead fields={[['Status', 'Not found'], ['Invites', 'Ask for a fresh link']]} title="This page didn’t make the trip." intro="The link may be mistyped or out of date. If a friend sent you an invite, ask them to share it again from their trip.">
        <div className="website-actions">
          <Link to="/" className="website-button website-button-primary">Back to Stowaway</Link>
          <Link to="/app" className="website-text-link">Find your trips</Link>
        </div>
      </TagHead>
    </WebsiteFrame>
  )
}
