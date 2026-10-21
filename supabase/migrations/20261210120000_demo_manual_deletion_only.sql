-- Expired Demos are deleted only by the Platform Owner, by hand: the Platform Center no
-- longer runs platform-housekeeping, and the setting it read is set to 0 (= never), so
-- a manual call of that function deletes nothing either.
update public.platform_settings set demo_auto_purge_after_days = 0 where id = 'global';
