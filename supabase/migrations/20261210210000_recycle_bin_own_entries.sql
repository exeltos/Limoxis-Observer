-- Recycle bin: each person sees and empties only their own deletions, whatever
-- their role (the Hospital Admin and the module leads no longer see the others').
-- The app reads it through bin_list_mine / bin_purge_mine; these policies make the
-- table itself say the same. Run by the owner in the SQL Editor (drop policy).

drop policy if exists recycle_bin_read on public.recycle_bin;
drop policy if exists recycle_bin_delete on public.recycle_bin;

create policy recycle_bin_read on public.recycle_bin for select to authenticated
  using (deleted_by = (select auth.uid()));

create policy recycle_bin_delete on public.recycle_bin for delete to authenticated
  using (deleted_by = (select auth.uid()));
