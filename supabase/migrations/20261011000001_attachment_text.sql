-- Text read from a ticket, receipt or document (on the phone: the PDF's text layer or OCR of a
-- photo; or edited by hand), plus details an AI pulled out of it (merchant, amount, date,
-- confirmation code, flight). Nullable, so phones running an older app keep working: PostgREST
-- upserts only update the columns they send.
alter table public.attachments
  add column text text check (text is null or char_length(text) <= 20000),
  add column text_source text check (text_source is null or text_source in ('pdf', 'ocr', 'ai', 'edited')),
  add column details jsonb check (details is null or jsonb_typeof(details) = 'object');
