-- The demo expiry check (CTRL-0003 «Λήξεις φαρμάκων και υλικών») becomes a list
-- check: every entry goes through a list of ten medicines and supplies, each with
-- quantity, form, expiry date and note, so the Expiry tab and the bell alerts
-- have something to show. Expiry dates sit around the day the demo is seeded.
-- New demos get it from private.demo_seed_controls; the existing demo
-- organizations are updated once below. Nothing outside demo organizations changes.

create or replace function private.demo_expiry_control_config(p_now timestamptz)
returns jsonb language sql stable set search_path = ''
as $function$
  select jsonb_build_object(
    'mode', 'list', 'template', 'medication_expiry', 'label', 'Ευρήματα', 'criticality', 'medium',
    'expiryBeforeDays', 30, 'expiryAfterDays', 7,
    'expiryCatalogue', (
      select jsonb_agg(jsonb_build_object(
        'id', 'cat-demo-' || i.ord, 'item', i.item, 'quantity', i.quantity, 'form', i.form,
        'expiry', to_char((p_now + make_interval(days => i.days))::date, 'YYYY-MM-DD'),
        'note', i.note, 'departments', '[]'::jsonb) order by i.ord)
      from (values
        (1, 'Adrenaline 1mg/ml', '10', 'ampoule', -6, ''),
        (2, 'Atropine 0.5mg/ml', '6', 'ampoule', 12, ''),
        (3, 'Amiodarone 150mg/3ml', '4', 'ampoule', 75, ''),
        (4, 'Φυσιολογικός ορός 0,9% 500ml', '24', 'bottle', 160, ''),
        (5, 'Ηπαρίνη 5.000 IU/ml', '8', 'vial', 25, 'Στο ψυγείο'),
        (6, 'Midazolam 5mg/ml', '5', 'ampoule', -2, 'Ελεγχόμενο'),
        (7, 'Παρακεταμόλη 500mg', '40', 'tablet', 210, ''),
        (8, 'Σύριγγες 10ml', '120', 'piece', 400, ''),
        (9, 'Χλωρεξιδίνη 2% διάλυμα', '12', 'flacon', 48, ''),
        (10, 'Naloxone 0.4mg/ml', '3', 'ampoule', 19, 'Τροχήλατο ανάνηψης')
      ) i(ord, item, quantity, form, days, note)
    )
  )
$function$;

revoke all on function private.demo_expiry_control_config(timestamptz) from public, anon, authenticated;

-- New demos: the seed uses the list configuration for CTRL-0003.
do $migration$
declare
  v_def text := pg_get_functiondef('private.demo_seed_controls(uuid,uuid)'::regprocedure);
  v_old text := '''{"mode":"choice","label":"Εύρημα","options":["Χωρίς εύρημα","Κοντόληκτο","Ληγμένο"],"reportOn":["Κοντόληκτο","Ληγμένο"],"criticality":"medium"}''::jsonb';
begin
  if position(v_old in v_def) = 0 then
    raise exception 'demo_seed_controls no longer has the expected CTRL-0003 configuration';
  end if;
  execute replace(v_def, v_old, 'private.demo_expiry_control_config(v_now)');
end
$migration$;

-- Existing demos: the same configuration, keeping each control's metadata.
update public.control_definitions cd
set response_config = private.demo_expiry_control_config(now())
      || jsonb_build_object('__meta', coalesce(cd.response_config->'__meta', '{}'::jsonb)),
    updated_at = now()
from public.organizations o
where o.id = cd.organization_id
  and o.is_demo
  and cd.code = 'CTRL-0003'
  and cd.response_config->>'mode' = 'choice';
