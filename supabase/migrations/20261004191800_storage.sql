-- Bucket privado para capturas y fotos de facturas. Sin políticas: solo el
-- servidor (con la secret key) sube y genera enlaces firmados.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do nothing;
