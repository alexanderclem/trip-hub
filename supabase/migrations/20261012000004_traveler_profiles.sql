-- Profile images are resized JPEG data URLs so edits also work offline.
alter table public.members
  add column if not exists avatar_url text,
  add column if not exists venmo_username text;

-- Some installations already received these fields during profile development.
-- Keep replay safe while retaining the same validation on fresh installations.
do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.members'::regclass and conname = 'members_avatar_url_check') then
    alter table public.members add constraint members_avatar_url_check check (
      avatar_url is null or (avatar_url like 'data:image/jpeg;base64,%' and length(avatar_url) <= 200000)
    );
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.members'::regclass and conname = 'members_venmo_username_check') then
    alter table public.members add constraint members_venmo_username_check check (
      venmo_username is null or venmo_username ~ '^[a-zA-Z0-9_-]{5,30}$'
    );
  end if;
end $$;
