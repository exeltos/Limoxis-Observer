-- FOR THE OWNER (SQL Editor): the agent does not run drop constraint.
-- organizations.enabled_modules accepted only ten module names, so kitchen, suppliers, interviews,
-- analysis and executive could never be listed in a custom module set (they were always locked).
-- Checked in production: the constraint lists exactly the ten older names; no row is changed.
alter table public.organizations drop constraint organizations_enabled_modules_check;
alter table public.organizations add constraint organizations_enabled_modules_check
  check (enabled_modules is null or enabled_modules <@ array['patients','laboratory','national','surveillance','indicators','prevention','controls','quality','training','governance','kitchen','suppliers','interviews','analysis','executive']::text[]);
