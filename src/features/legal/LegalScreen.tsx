import { Link } from 'react-router'
import { WebsiteFrame } from '@/features/website/WebsiteFrame'
import { TagHead } from '@/features/website/tag/parts'

export function LegalScreen({ policy }: { policy: 'privacy' | 'terms' }) {
  return <WebsiteFrame>
    <TagHead fields={[['Updated', 'October 30, 2026'], ['Applies to', 'joinstowaway.app']]} title={policy === 'privacy' ? 'Privacy policy' : 'Terms of use'} />
    <article className="tag-shell tag-legal">
      {policy === 'privacy' ? <>
        <h2 className="ui-section-title">Your shared trip data</h2>
        <p>Stowaway stores trip plans, votes, group preferences, expenses, and documents on your device and synchronizes shared data through Supabase. People with access to your trip can see its shared data. Keep your trip invite link private and only upload information you intend to share with your group.</p>
        <h2 className="ui-section-title">Booking a trip with an organizer</h2>
        <p>When you book a trip an organizer sells through Stowaway, your name, email, payments and booking are stored so the organizer can run the trip; card details go only to Stripe. If the organizer asks questions at booking (such as dietary or accessibility needs, or an emergency contact), your answers can include health information. Only that organizer and you can see them, and you can change them from your booking link. The organizer keeps a list of the people who have booked with them. They may email you about future trips only if you ticked that box when booking, and every such email lets you stop. To have your booking answers removed, ask the organizer or <a className="text-action underline" href="https://github.com/alexanderclem/trip-hub/issues">contact the project maintainer</a> without posting private details.</p>
        <h2 className="ui-section-title">Services used by the app</h2>
        <p>Cloudflare hosts Stowaway and processes requested AI suggestions. Supabase provides sign-in, shared trip storage, and synchronization. Google sign-in is optional when available. Map and routing services receive the requests needed to display maps and estimate journeys. These providers may process technical information such as your IP address under their own policies.</p>
        <h2 className="ui-section-title">Optional Google traffic checks</h2>
        <p>When you select “Check driving traffic”, Stowaway sends the two selected places’ stored coordinates to Google Maps Platform through its server. It does not send your vote, name, itinerary, or document contents with that request. Traffic results are temporary, are not saved to trip storage, and disappear after five minutes or when you go offline.</p>
        <p>Google processes requests under its <a className="text-action underline" href="https://policies.google.com/privacy">Privacy Policy</a>. Use of Google Maps features is also subject to the <a className="text-action underline" href="https://maps.google.com/help/terms_maps/">Google Maps/Google Earth Additional Terms of Service</a>.</p>
        <h2 className="ui-section-title">Device storage and questions</h2>
        <p>To learn which parts of Stowaway help groups, the app records anonymous counts of steps people reach, such as creating a trip, sharing an invite, or opening the payments offer. These records never include names, messages, plans, documents or amounts, and no third-party analytics service receives them. If you ask for early access to payments, your email address is stored separately and used only to tell you when payments are ready.</p>
        <p>Preparing offline access stores trip information and downloaded files on your device. Removing local browser data does not delete shared server data. For privacy questions or shared-data removal requests, <a className="text-action underline" href="https://github.com/alexanderclem/trip-hub/issues">contact the project maintainer</a>; do not post trip links, documents, or private information in a public issue.</p>
      </> : <>
        <h2 className="ui-section-title">Using Stowaway</h2>
        <p>Stowaway helps groups plan trips, compare options, and organize shared information. Share only content you have permission to share, protect your trip invite link, and respect other travelers’ information. Do not misuse the app or its connected services.</p>
        <h2 className="ui-section-title">Plans and estimates</h2>
        <p>Votes express group preferences. Suggested itineraries, travel times, costs, and traffic estimates are planning aids and can be incomplete or inaccurate. Confirm reservations, opening hours, prices, routes, and safety conditions with the relevant provider before traveling. Stowaway does not make bookings or guarantee availability or arrival times.</p>
        <h2 className="ui-section-title">Google Maps features</h2>
        <p>Use of Google traffic estimates is subject to the <a className="text-action underline" href="https://maps.google.com/help/terms_maps/">Google Maps/Google Earth Additional Terms of Service</a> and <a className="text-action underline" href="https://policies.google.com/privacy">Google Privacy Policy</a>.</p>
        <h2 className="ui-section-title">Availability</h2>
        <p>Stowaway is provided as available. Features may change or be interrupted. Prepare your offline data before travel and keep separate copies of essential documents.</p>
      </>}
      <p><Link className="text-action underline" to={policy === 'privacy' ? '/terms' : '/privacy'}>{policy === 'privacy' ? 'Terms of use' : 'Privacy policy'}</Link></p>
    </article>
  </WebsiteFrame>
}
