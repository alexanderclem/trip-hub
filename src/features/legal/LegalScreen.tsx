import { Link } from 'react-router'
import { PageHeader } from '@/ui'

export function LegalScreen({ policy }: { policy: 'privacy' | 'terms' }) {
  return <div className="min-h-full overflow-y-auto pb-10">
    <PageHeader title={policy === 'privacy' ? 'Privacy policy' : 'Terms of use'} back="/" />
    <article className="mx-auto max-w-2xl space-y-5 px-5 py-6 text-base leading-relaxed text-stone-700">
      <p className="text-sm text-stone-600">Updated October 8, 2026</p>
      {policy === 'privacy' ? <>
        <h2 className="ui-section-title">Your shared trip data</h2>
        <p>Stowaway stores trip plans, votes, group preferences, expenses, and documents on your device and synchronizes shared data through Supabase. People with access to your trip can see its shared data. Keep your trip invite link private and only upload information you intend to share with your group.</p>
        <h2 className="ui-section-title">Services used by the app</h2>
        <p>Cloudflare hosts Stowaway and processes requested AI suggestions. Supabase provides sign-in, shared trip storage, and synchronization. Google sign-in is optional when available. Map and routing services receive the requests needed to display maps and estimate journeys. These providers may process technical information such as your IP address under their own policies.</p>
        <h2 className="ui-section-title">Optional Google traffic checks</h2>
        <p>When you select “Check driving traffic”, Stowaway sends the two selected places’ stored coordinates to Google Maps Platform through its server. It does not send your vote, name, itinerary, or document contents with that request. Traffic results are temporary, are not saved to trip storage, and disappear after five minutes or when you go offline.</p>
        <p>Google processes requests under its <a className="text-brand-700 underline" href="https://policies.google.com/privacy">Privacy Policy</a>. Use of Google Maps features is also subject to the <a className="text-brand-700 underline" href="https://maps.google.com/help/terms_maps/">Google Maps/Google Earth Additional Terms of Service</a>.</p>
        <h2 className="ui-section-title">Device storage and questions</h2>
        <p>Preparing offline access stores trip information and downloaded files on your device. Removing local browser data does not delete shared server data. For privacy questions or shared-data removal requests, <a className="text-brand-700 underline" href="https://github.com/alexanderclem/trip-hub/issues">contact the project maintainer</a>; do not post trip links, documents, or private information in a public issue.</p>
      </> : <>
        <h2 className="ui-section-title">Using Stowaway</h2>
        <p>Stowaway helps groups plan trips, compare options, and organize shared information. Share only content you have permission to share, protect your trip invite link, and respect other travelers’ information. Do not misuse the app or its connected services.</p>
        <h2 className="ui-section-title">Plans and estimates</h2>
        <p>Votes express group preferences. Suggested itineraries, travel times, costs, and traffic estimates are planning aids and can be incomplete or inaccurate. Confirm reservations, opening hours, prices, routes, and safety conditions with the relevant provider before traveling. Stowaway does not make bookings or guarantee availability or arrival times.</p>
        <h2 className="ui-section-title">Google Maps features</h2>
        <p>Use of Google traffic estimates is subject to the <a className="text-brand-700 underline" href="https://maps.google.com/help/terms_maps/">Google Maps/Google Earth Additional Terms of Service</a> and <a className="text-brand-700 underline" href="https://policies.google.com/privacy">Google Privacy Policy</a>.</p>
        <h2 className="ui-section-title">Availability</h2>
        <p>Stowaway is provided as available. Features may change or be interrupted. Prepare your offline data before travel and keep separate copies of essential documents.</p>
      </>}
      <p><Link className="text-brand-700 underline" to={policy === 'privacy' ? '/terms' : '/privacy'}>{policy === 'privacy' ? 'Terms of use' : 'Privacy policy'}</Link></p>
    </article>
  </div>
}
