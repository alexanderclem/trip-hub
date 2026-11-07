import { ProgressiveImage } from '@/ui/ProgressiveImage'

/**
 * The traveler's side as one picture: the public trip page leads, and the booking summary they reach from it
 * sits over the page's lower corner. No checkout button: the preview must never look like it takes a payment.
 * Titles are divs, not headings, so the picture stays out of the page outline.
 */
export function OrganizerBookingPreview() {
  return <figure className="operator-booking-examples" aria-labelledby="operator-booking-caption">
    <div className="operator-booking-stage">
      <div className="operator-booking-page">
        <ProgressiveImage src="/images/trip-covers/flat-v2/city-small.jpg" placeholder="/images/trip-covers/flat-v2/city-placeholder.jpg" loading="lazy" width={480} height={192} alt="" className="operator-booking-image" />
        <div className="operator-booking-content">
          <p className="website-eyebrow">June 11–14, 2027 · 4 days</p>
          <div className="operator-booking-title">Four days in Paris</div>
          <p className="marketing-body">Museums, neighborhood walks and a day in Versailles.</p>
          <dl><div><dt>Trip price per person</dt><dd>$1,000</dd></div><div><dt>Reserve with a deposit</dt><dd>$300</dd></div></dl>
        </div>
      </div>
      <div className="operator-booking-summary">
        <p className="website-eyebrow">Your booking · 1 traveler</p>
        <dl><div><dt>Trip total</dt><dd>$1,000</dd></div><div className="booking-deposit"><dt>Deposit due today</dt><dd>$300</dd></div><div><dt>Balance due May 11, 2027</dt><dd>$700</dd></div></dl>
      </div>
    </div>
    <figcaption id="operator-booking-caption" className="operator-preview-caption">Your public trip page carries the itinerary, inclusions and cancellation policy; the booking summary shows what’s due now and later. Illustrative amounts; this preview can’t take a booking or payment.</figcaption>
  </figure>
}
