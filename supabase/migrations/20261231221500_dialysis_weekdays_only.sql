-- Έλεγχοι: η Μονάδα Τεχνητού Νεφρού του ΙΑΣΩ δεν λειτουργεί Σαββατοκύριακο (απόφαση ιδιοκτήτη 2/11/2026), όπως το Αιμοδυναμικό,
-- η Χημειοθεραπεία, το Ενδοσκοπικό και το Οφθαλμολογικό (που έχουν ήδη «μόνο καθημερινές»). Οι καθημερινοί της έλεγχοι παίρνουν
-- frequency.weekdaysOnly και η επόμενη προθεσμία ξαναϋπολογίζεται από την τελευταία εκτέλεση. Μόνο ενημέρωση, τίποτα δεν σβήνεται.
do $$
declare
  org uuid := '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd';
begin
  if not exists (select 1 from public.organizations where id = org) then return; end if;
  perform set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
  update public.control_assignments a
     set frequency_config = coalesce(a.frequency_config, c.frequency_config) || '{"weekdaysOnly": true}'::jsonb
    from public.control_definitions c, public.departments d
   where c.id = a.control_id and d.id = a.department_id and a.organization_id = org and d.name = 'Μονάδα Τεχνητού Νεφρού'
     and coalesce(a.frequency_config, c.frequency_config) ->> 'kind' = 'daily'
     and coalesce(coalesce(a.frequency_config, c.frequency_config) ->> 'weekdaysOnly', '') <> 'true';
  update public.control_assignments a
     set next_due_at = private.control_next_due(a.frequency_config, a.last_completed_at,
           (select count(*)::integer from public.control_executions e where e.assignment_id = a.id and e.cancelled_at is null and coalesce(e.is_extra, false) = false
              and (e.performed_at at time zone 'Europe/Athens')::date = (a.last_completed_at at time zone 'Europe/Athens')::date))
    from public.departments d
   where d.id = a.department_id and a.organization_id = org and d.name = 'Μονάδα Τεχνητού Νεφρού'
     and a.frequency_config ->> 'weekdaysOnly' = 'true' and a.last_completed_at is not null;
end
$$;
