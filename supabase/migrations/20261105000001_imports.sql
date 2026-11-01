-- Phase 4: moving to Stowaway. An organizer imports past travelers from another tool's CSV (read on
-- the phone). Consent to marketing email never carries over: it can only come from the traveler.

create function public.import_contacts(p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := private.my_organizer_id();
  r jsonb;
  v_email text;
  v_tags text[];
  v_added integer := 0;
  v_updated integer := 0;
  v_new boolean;
begin
  perform private.require_pro(v_org);
  if jsonb_typeof(coalesce(p_rows, '[]')) <> 'array' or jsonb_array_length(coalesce(p_rows, '[]')) > 2000 then
    raise exception 'Up to 2,000 travelers at a time' using errcode = '22023';
  end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    v_email := lower(trim(coalesce(r ->> 'email', '')));
    if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then continue; end if;
    select coalesce(array_agg(distinct left(lower(trim(t)), 30)) filter (where trim(t) <> ''), '{}') into v_tags
    from jsonb_array_elements_text(coalesce(r -> 'tags', '[]')) t;
    insert into public.organizer_contacts (organizer_id, email, name, tags)
    values (v_org, v_email, left(coalesce(nullif(trim(r ->> 'name'), ''), split_part(v_email, '@', 1)), 80), v_tags[1:10])
    on conflict (organizer_id, email) do update
      set tags = (select coalesce(array_agg(distinct x), '{}') from unnest(organizer_contacts.tags || excluded.tags) x)[1:10],
          updated_at = now()
    returning (xmax = 0) into v_new;
    if v_new then v_added := v_added + 1; else v_updated := v_updated + 1; end if;
  end loop;
  return jsonb_build_object('added', v_added, 'updated', v_updated);
end $$;

revoke execute on function public.import_contacts(jsonb) from public;
grant execute on function public.import_contacts(jsonb) to authenticated;

notify pgrst, 'reload schema';
