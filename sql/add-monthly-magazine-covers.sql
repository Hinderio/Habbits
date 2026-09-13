-- Run once in the Supabase SQL editor if companion-posters has no SELECT policy.
-- Allows signed-in users to discover only magazine images in the public poster bucket.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Authenticated users can list magazine covers'
  ) then
    create policy "Authenticated users can list magazine covers"
      on storage.objects for select to authenticated
      using (
        bucket_id = 'companion-posters'
        and name ~* '^stage-(2[1-9]|[3-9][0-9]|[1-9][0-9]{2,})[.](png|jpe?g|webp|avif)$'
      );
  end if;
end
$$;
