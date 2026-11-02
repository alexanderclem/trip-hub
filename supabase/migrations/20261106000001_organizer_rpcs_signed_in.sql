-- Supabase grants new functions to anon by default, and revoking from public doesn't remove that grant.
-- These organizer tools already refuse anyone who isn't a signed-in organizer, but they shouldn't be
-- callable without signing in at all. (The traveler-facing ones stay open to anon on purpose:
-- get_public_offer, get_booking, get_hold, join_waitlist, update_booking_answers, unsubscribe.)

revoke execute on function
  public.campaign_audience(jsonb),
  public.import_contacts(jsonb),
  public.offer_waitlist_place(uuid),
  public.queue_campaign(uuid),
  public.remove_waitlist_entry(uuid),
  public.save_campaign(uuid, text, text, jsonb),
  public.save_contact(uuid, text[], text),
  public.save_offer_questions(uuid, jsonb),
  public.save_organizer_address(text),
  public.save_referral_settings(bigint),
  public.save_room_options(uuid, jsonb),
  public.send_campaign_test(uuid)
from anon;
