/**
 * Every public, indexable page. The build prerenders each one (scripts/prerender.ts), lists it in
 * sitemap.xml, and the Worker serves it with a 200; any other path that isn't an app route is a 404.
 */
export const publicPages: Record<string, { title: string; description: string; crumb?: string }> = {
  '/': { title: 'Stowaway — Free group trip planner that works offline', description: 'Plan a trip with friends from one shared link: save places, vote, build the itinerary, split costs and keep tickets offline. Free, with nothing to download.' },
  '/how-it-works': { title: 'How Stowaway works — Plan a group trip step by step', description: 'Create a shared trip, invite friends by link, save places, vote, build the day-by-day plan, split costs, keep tickets and get every phone ready for offline.', crumb: 'How it works' },
  '/organizers': { title: 'Stowaway for trip organizers — Run group trips in one place', description: 'For people who run group trips: a public trip page, traveler lists, hosted permissions, rooming and waitlists. Payment collection is in early access.', crumb: 'For organizers' },
  '/pricing': { title: 'Stowaway pricing — Free group planning, 1% to collect payments', description: 'Group trip planning is free, offline use included. Organizers who collect payments pay a flat 1% plus Stripe’s fee. Calculate what you keep.', crumb: 'Pricing' },
  '/help': { title: 'Stowaway help & contact — Joining, accounts & offline trips', description: 'Get help joining a trip, signing in, preparing for offline use, shared expenses and organizer tools, and contact the person who runs Stowaway.', crumb: 'Help' },
  '/group-expenses': { title: 'Split group trip expenses, free and offline — Stowaway', description: 'Track who paid for what on a group trip. Split equally, by shares, exact amounts or percentages, log local currency, and settle up in the fewest payments.', crumb: 'Group expenses' },
  '/tools/trip-cost-splitter': { title: 'Trip cost splitter — Free calculator for group trips', description: 'Add who paid for what and see who owes whom, settled in the fewest payments. Free, no sign-up, and it runs entirely in your browser.', crumb: 'Trip cost splitter' },
  '/compare/best-group-trip-planner-apps': { title: 'Group trip planner apps compared (2026) — Stowaway', description: 'An honest look at Wanderlog, Splitwise, Tricount, TripIt, a group chat and Stowaway for planning a trip with friends: what each does well and what it costs.', crumb: 'Group trip apps compared' },
  '/compare/splitwise-alternative-for-group-trips': { title: 'A Splitwise alternative for group trips — Stowaway', description: 'Splitting costs on a trip? Compare Splitwise and Stowaway: daily limits, currencies, offline entry, and a shared plan alongside the balances.', crumb: 'Splitwise alternative' },
  '/spring-break-trip-planner': { title: 'Spring break trip planner for groups — Stowaway', description: 'Plan spring break with your friends in one link: pick where to go, vote on the days, split the house and the shuttles, and keep tickets offline.', crumb: 'Spring break trips' },
  '/bachelor-party-trip-planner': { title: 'Bachelor & bachelorette trip planner — Stowaway', description: 'Plan a bachelor or bachelorette weekend with the whole group: vote on activities, share one itinerary, split the costs fairly, and keep bookings together.', crumb: 'Bachelor & bachelorette trips' },
  '/privacy': { title: 'Privacy policy — Stowaway', description: 'How Stowaway stores and shares trip plans, bookings and device data, which services process it, and how to contact the person who runs Stowaway.', crumb: 'Privacy' },
  '/terms': { title: 'Terms of use — Stowaway', description: 'The terms for using Stowaway to plan group trips, including organizer trips, estimates, availability and how to get in touch.', crumb: 'Terms' },
}

/** Who runs Stowaway: shown on Help, the legal pages and in structured data. */
export const MAINTAINER = { name: 'Alexander Clem', email: 'alexanderclem12@gmail.com' }
