-- ============================================================
--  almacenamiento_feed
--  Bucket público «feed-media» para las imágenes del Feed en React.
--  Las URLs se guardan en posts.images igual que antes los data-URL, así
--  que el Feed aislado y el clásico las muestran sin cambios.
--  Solo administradores suben, reemplazan o borran archivos.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feed-media', 'feed-media', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy feed_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'feed-media' and public.is_admin());
create policy feed_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'feed-media' and public.is_admin()) with check (bucket_id = 'feed-media' and public.is_admin());
create policy feed_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'feed-media' and public.is_admin());
