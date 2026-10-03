-- Restore the core migration's intended permissions for the "Who are you?" RPCs.
-- Anonymous sign-ins use authenticated; unauthenticated anon stays excluded.
-- Run as postgres in the SQL editor. Both functions still check trip access.
begin;
revoke execute on function public.create_member_and_claim(uuid, uuid, text, text) from public, anon;
grant execute on function public.create_member_and_claim(uuid, uuid, text, text) to authenticated;
revoke execute on function public.claim_member(uuid, uuid) from public, anon;
grant execute on function public.claim_member(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';
commit;

select
  has_function_privilege('authenticated', 'public.create_member_and_claim(uuid,uuid,text,text)', 'EXECUTE') as can_add_travelers,
  has_function_privilege('authenticated', 'public.claim_member(uuid,uuid)', 'EXECUTE') as can_claim_member;
