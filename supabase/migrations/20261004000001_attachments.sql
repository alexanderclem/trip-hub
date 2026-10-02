-- Tickets, reservations, receipts: file metadata (synced) + the files themselves in a private
-- Storage bucket at attachments/<trip_id>/<attachment_id>/<filename>. Phones keep their own copy
-- of each file (IndexedDB/OPFS) so tickets open with no signal.

create table public.attachments (
  id uuid primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  item_id uuid references public.itinerary_items (id),
  place_id uuid references public.places (id),
  expense_id uuid references public.expenses (id),
  kind text not null default 'ticket' check (kind in ('ticket', 'reservation', 'receipt', 'document', 'photo')),
  title text not null check (length(trim(title)) between 1 and 200),
  confirmation_code text,
  storage_path text not null,
  filename text not null,
  mime text not null,
  bytes integer not null check (bytes > 0 and bytes <= 15728640),
  sha256 text not null,
  uploaded_at timestamptz, -- null until the file has reached Storage
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  check (storage_path like trip_id::text || '/' || id::text || '/%')
);

create trigger sync_guard before insert or update on public.attachments
  for each row execute function private.sync_guard();
create index attachments_sync_idx on public.attachments (trip_id, updated_at);
create index attachments_item_idx on public.attachments (item_id);
alter table public.attachments enable row level security;
create policy attachments_select on public.attachments for select to authenticated
  using ((select private.has_trip_access(trip_id)));
create policy attachments_insert on public.attachments for insert to authenticated
  with check ((select private.has_trip_access(trip_id)));
create policy attachments_update on public.attachments for update to authenticated
  using ((select private.has_trip_access(trip_id)))
  with check ((select private.has_trip_access(trip_id)));
alter publication supabase_realtime add table public.attachments;

-- ─── Storage ────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 15728640,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects live under <trip_id>/…; a device may touch them only if it joined that trip.
create or replace function private.object_trip_access(object_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  return private.has_trip_access(split_part(object_name, '/', 1)::uuid);
exception when others then
  return false; -- not a trip folder
end $$;
revoke all on function private.object_trip_access(text) from public;
grant execute on function private.object_trip_access(text) to authenticated;

create policy "attachments: read own trips" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and (select private.object_trip_access(name)));
create policy "attachments: upload to own trips" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and (select private.object_trip_access(name)));
create policy "attachments: replace in own trips" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and (select private.object_trip_access(name)))
  with check (bucket_id = 'attachments' and (select private.object_trip_access(name)));
-- No delete policy: a removed ticket is a soft-deleted row; its file stays (like everything else).
