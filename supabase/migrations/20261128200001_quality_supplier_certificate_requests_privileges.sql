-- The privileges of 20261128200000 once more (that migration was applied in two
-- steps on the hosted project): reading only for signed-in users, the link page for
-- anonymous visitors, the helpers to nobody. Idempotent.
revoke all on public.quality_supplier_certificate_requests from anon;
revoke insert, update, delete on public.quality_supplier_certificate_requests from authenticated;
revoke all on function private.quality_supplier_certificate_can_manage(uuid) from public, anon;
revoke all on function private.quality_supplier_certificate_issue_link(uuid) from public, anon, authenticated;
revoke all on function public.quality_supplier_certificate_requests_create(uuid, jsonb, boolean) from public, anon;
revoke all on function public.quality_supplier_certificate_request_action(uuid, text, text, boolean) from public, anon;
revoke all on function public.quality_supplier_certificate_access(text) from public;
grant select on public.quality_supplier_certificate_requests to authenticated;
grant execute on function private.quality_supplier_certificate_can_manage(uuid) to authenticated;
grant execute on function public.quality_supplier_certificate_requests_create(uuid, jsonb, boolean) to authenticated;
grant execute on function public.quality_supplier_certificate_request_action(uuid, text, text, boolean) to authenticated;
grant execute on function public.quality_supplier_certificate_access(text) to anon, authenticated;
