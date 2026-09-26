-- Production already denies anon on these SECURITY DEFINER functions (the
-- revokes were applied outside the migration history). Revoke them here too so
-- a database rebuilt from migrations matches production: none of them is meant
-- for visitors who are not signed in. No-op on production.
revoke execute on function public.current_user_can_read_antiseptic(uuid, uuid) from public, anon;
revoke execute on function public.current_user_can_write_antiseptic(uuid, uuid) from public, anon;
revoke execute on function public.current_user_can_read_hand_hygiene(uuid, uuid) from public, anon;
revoke execute on function public.current_user_can_write_hand_hygiene(uuid, uuid) from public, anon;
revoke execute on function public.current_user_can_read_prevention_bundle(uuid, uuid) from public, anon;
revoke execute on function public.current_user_can_write_prevention_bundle(uuid, uuid) from public, anon;
revoke execute on function public.current_user_can_read_waste(uuid, uuid) from public, anon;
revoke execute on function public.current_user_can_write_waste(uuid, uuid) from public, anon;
revoke execute on function public.platform_report_summary(uuid, date, date, uuid) from public, anon;

grant execute on function public.current_user_can_read_antiseptic(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_write_antiseptic(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_read_hand_hygiene(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_write_hand_hygiene(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_read_prevention_bundle(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_write_prevention_bundle(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_read_waste(uuid, uuid) to authenticated;
grant execute on function public.current_user_can_write_waste(uuid, uuid) to authenticated;
grant execute on function public.platform_report_summary(uuid, date, date, uuid) to authenticated;
