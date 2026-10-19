-- The kitchen (HACCP) in every Demo organization: the same week as the browser demo
-- (src/features/kitchen/kitchenDemoData.js) with dates from today — receipts with one
-- batch out of limits, production days with raw materials, heat parameters, pureeing and
-- disinfection, defrosts with their HACCP sign-off, a batch withdrawn, days waiting for
-- verification and three planned days. demo_seed_data fills it with the rest of the
-- Demo; the existing Demos are filled now. Names are made up.

-- Split into small functions so each one can be applied on its own.

-- The catalogue, menus and settings (the refill empties the Demo's kitchen first).
create or replace function private.demo_seed_kitchen_base(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_cook text := 'Μαρία Παπαδοπούλου';
  v_chef text := 'Γιώργος Νικολάου';
  v_manager text := 'Ελένη Γεωργίου';
  v_meat text := 'Κρεατεμπορική Θεσσαλίας Α.Ε.';
  v_dairy text := 'Γαλακτοκομικά Κάμπου Α.Ε.';
  v_fruit text := 'Οπωροπωλείο Θεσσαλίας Ο.Ε.';
  v_menus text[] := array[
    E'Μεσημεριανό\nΚοτόπουλο λεμονάτο με πατάτες\nΣαλάτα εποχής\n\nΒραδινό\nΡύζι με λαχανικά\nΓιαούρτι',
    E'Μεσημεριανό\nΜοσχάρι κοκκινιστό με κριθαράκι\nΣαλάτα λάχανο-καρότο\n\nΒραδινό\nΚοτόσουπα\nΦρούτο',
    E'Μεσημεριανό\nΨάρι φιλέτο φούρνου με λαχανικά\nΣαλάτα εποχής\n\nΒραδινό\nΜακαρόνια με σάλτσα ντομάτας\nΓιαούρτι',
    E'Μεσημεριανό\nΚεφτεδάκια κοτόπουλο με πουρέ\nΣαλάτα εποχής\n\nΒραδινό\nΧορτόσουπα\nΦρούτο',
    E'Μεσημεριανό\nΧοιρινή μπριζόλα σχάρας με ρύζι\nΣαλάτα λάχανο\n\nΒραδινό\nΟμελέτα με λαχανικά\nΓιαούρτι',
    E'Μεσημεριανό\nΚοτόπουλο φούρνου με πατάτες\nΣαλάτα εποχής\n\nΒραδινό\nΦακές σούπα\nΦρούτο',
    E'Μεσημεριανό\nΜοσχάρι λεμονάτο με πουρέ\nΣαλάτα εποχής\n\nΒραδινό\nΚοτόσουπα\nΓιαούρτι'];
  i integer;
begin
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations get the Demo kitchen' using errcode = '42501';
  end if;
  -- A refill starts from an empty kitchen (the Demo's own rows only).
  delete from public.kitchen_material_usage where organization_id = v_org;
  delete from public.kitchen_thermal_processes where organization_id = v_org;
  delete from public.kitchen_pureeing where organization_id = v_org;
  delete from public.kitchen_defrosting where organization_id = v_org;
  delete from public.kitchen_stock_writeoffs where organization_id = v_org;
  delete from public.kitchen_receipts where organization_id = v_org;
  delete from public.kitchen_productions where organization_id = v_org;
  delete from public.kitchen_menus where organization_id = v_org;
  delete from public.kitchen_products where organization_id = v_org;
  perform private.kitchen_seed_defaults(v_org);
  update public.kitchen_settings set haccp_last_review_on = d0 - 340,
    haccp_team = v_manager || ' (υπεύθυνη κουζίνας), Υπεύθυνος Ποιότητας, Νοσηλεύτρια Επιτήρησης Λοιμώξεων' where organization_id = v_org;

  insert into public.kitchen_products (organization_id, name, category, storage, unit, low_stock_quantity, source)
  values (v_org, 'Στήθος κοτόπουλο φιλέτο', 'poultry', 'chilled', 'kg', 15, 'demo'), (v_org, 'Μπούτι κοτόπουλο κατεψυγμένο', 'poultry', 'frozen', 'kg', 10, 'demo'),
    (v_org, 'Κιμάς μόσχου', 'meat', 'chilled', 'kg', 5, 'demo'), (v_org, 'Χοιρινή μπριζόλα', 'meat', 'chilled', 'kg', null, 'demo'),
    (v_org, 'Φιλέτο γλώσσας κατεψυγμένο', 'fish', 'frozen', 'kg', null, 'demo'), (v_org, 'Γάλα φρέσκο', 'dairy', 'chilled', 'l', 10, 'demo'),
    (v_org, 'Γιαούρτι αγελάδος', 'dairy', 'chilled', 'pcs', 40, 'demo'), (v_org, 'Ντομάτες', 'vegetables', 'ambient', 'kg', null, 'demo'),
    (v_org, 'Μήλα', 'fruit', 'ambient', 'kg', null, 'demo'), (v_org, 'Πατάτες', 'vegetables', 'ambient', 'kg', null, 'demo');

  for i in 1..7 loop
    insert into public.kitchen_menus (organization_id, name, weekday, menu_text, source)
    -- The i-th menu is the one cooked i − 7 days from today, so the week's records match their menus.
    values (v_org, (array['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο','Κυριακή'])[extract(isodow from d0 + i - 7)::integer],
      extract(isodow from d0 + i - 7)::integer, v_menus[i], 'demo');
  end loop;

  perform private.demo_seed_kitchen_receipts(v_org, d0, v_cook, v_chef, v_meat, v_dairy, v_fruit);
  perform private.demo_seed_kitchen_days(v_org, d0, v_chef, v_manager);
end;
$function$;
revoke all on function private.demo_seed_kitchen_base(uuid, uuid) from public, anon, authenticated;

-- Receipts and their products.
create or replace function private.demo_seed_kitchen_receipts(v_org uuid, d0 date, v_cook text, v_chef text, v_meat text, v_dairy text, v_fruit text)
returns void language plpgsql set search_path = ''
as $function$
begin
  -- Receipts: (code, supplier, day offset, time, class, temperature, failing check, notes, corrective action)
  insert into public.kitchen_receipts (organization_id, code, supplier_name, received_on, received_time, order_reference, receiver_name,
    temperature_check, packaging_check, expiry_check, vehicle_check, coding_check, temperature_class, measured_temperature, accepted, status, quality_notes, corrective_action, source)
  select v_org, r.code, r.supplier, d0 + r.off, r.t::time, r.ord, r.who,
    case when r.bad = 'temperature' then 'noncompliant' else 'compliant' end, 'compliant', 'compliant',
    case when r.bad = 'vehicle' then 'noncompliant' else 'compliant' end, 'compliant', r.cls, r.temp, true, 'completed', r.notes, r.action, 'demo'
  from (values
    ('PAR-0001', v_meat, -6, '07:40', '1042', v_chef, 'chilled', 3::numeric, '', null::text, null::text),
    ('PAR-0002', v_dairy, -5, '06:55', '1043', v_cook, 'chilled', 4, '', null, null),
    ('PAR-0003', v_meat, -4, '08:10', '1044', v_chef, 'frozen', -19, '', null, null),
    ('PAR-0004', v_fruit, -3, '07:20', '1045', v_cook, 'ambient', null, '', null, null),
    ('PAR-0005', v_meat, -2, '07:35', '1046', v_chef, 'chilled', 3, '', null, null),
    ('PAR-0006', v_dairy, -1, '06:50', '1047', v_cook, 'chilled', 5, 'vehicle', 'Το ψυγείο του οχήματος έδειχνε 8 °C· τα προϊόντα μετρήθηκαν στους 5 °C.', 'Ενημερώθηκε ο προμηθευτής· καταγράφηκε μη συμμόρφωση και ζητήθηκε έλεγχος του οχήματος.'),
    ('PAR-0007', v_meat, 0, '07:30', '1048', v_chef, 'chilled', 6.5, 'temperature', 'Ο κιμάς μετρήθηκε στους 7,5 °C στον πυρήνα.', 'Ο κιμάς επιστράφηκε στον προμηθευτή· το κοτόπουλο (3 °C) έγινε δεκτό. Αναφορά μη συμμόρφωσης προμηθευτή.')
  ) as r(code, supplier, off, t, ord, who, cls, temp, bad, notes, action);

  -- Receipt products: (receipt, position, product, batch, expiry offset from today, quantity, temperature, accepted, reason)
  insert into public.kitchen_receipt_items (organization_id, receipt_id, position, product_id, product_name, batch_code, expiry_on, quantity, unit, storage, temperature, accepted, rejection_reason)
  select v_org, k.id, x.pos, p.id, p.name, x.batch, case when x.exp is null then null else d0 + x.exp end, x.qty, p.unit, p.storage, x.temp, x.ok, x.reason
  from (values
    ('PAR-0001', 0, 'Στήθος κοτόπουλο φιλέτο', 'L2410-118', 0, 20::numeric, 3::numeric, true, null::text),
    ('PAR-0001', 1, 'Κιμάς μόσχου', 'K-5521', -2, 8, 2.5, true, null),
    ('PAR-0002', 0, 'Γάλα φρέσκο', 'G-0911', 1, 30, 4, true, null),
    ('PAR-0002', 1, 'Γιαούρτι αγελάδος', 'Y-3307', 13, 60, 4, true, null),
    ('PAR-0003', 0, 'Μπούτι κοτόπουλο κατεψυγμένο', 'FR-7781', 116, 25, -19, true, null),
    ('PAR-0003', 1, 'Φιλέτο γλώσσας κατεψυγμένο', 'FS-2210', 176, 12, -20, true, null),
    ('PAR-0004', 0, 'Ντομάτες', null, null, 15, null, true, null),
    ('PAR-0004', 1, 'Μήλα', null, null, 20, null, true, null),
    ('PAR-0004', 2, 'Πατάτες', null, null, 40, null, true, null),
    ('PAR-0005', 0, 'Χοιρινή μπριζόλα', 'P-0419', 1, 14, 3, true, null),
    ('PAR-0005', 1, 'Στήθος κοτόπουλο φιλέτο', 'L2410-131', 3, 18, 2, true, null),
    ('PAR-0006', 0, 'Γάλα φρέσκο', 'G-0918', 5, 30, 5, true, null),
    ('PAR-0007', 0, 'Στήθος κοτόπουλο φιλέτο', 'L2410-140', 6, 16, 3, true, null),
    ('PAR-0007', 1, 'Κιμάς μόσχου', 'K-5590', 4, 6, 7.5, false, 'Θερμοκρασία 7,5 °C (όριο ≤ 5 °C): επιστροφή στον προμηθευτή.')
  ) as x(code, pos, product, batch, exp, qty, temp, ok, reason)
  join public.kitchen_receipts k on k.organization_id = v_org and k.code = x.code
  join public.kitchen_products p on p.organization_id = v_org and p.name = x.product;
end;
$function$;
revoke all on function private.demo_seed_kitchen_receipts(uuid, date, text, text, text, text, text) from public, anon, authenticated;

-- Production days with meals; signed off up to two days ago.
create or replace function private.demo_seed_kitchen_days(v_org uuid, d0 date, v_chef text, v_manager text)
returns void language plpgsql set search_path = ''
as $function$
declare
  v_day record;
begin
  -- Production days: a week back, today and three planned days; signed off up to two days ago.
  for v_day in select g as off, d0 + g as day, extract(isodow from d0 + g)::integer as wd from generate_series(-6, 3) g loop
    insert into public.kitchen_productions (organization_id, production_date, menu_id, menu_text, notes, disinfection_vegetables, disinfection_fruit, disinfection_agent,
      disinfection_concentration_ppm, disinfection_minutes, recorded_by_name, source, verified_at, verified_by_name, verification_notes)
    select v_org, v_day.day, m.id, m.menu_text, case when v_day.off = -1 then 'Δύο επιπλέον μερίδες άναλης δίαιτας για την Παθολογική.' end,
      v_day.off <= 0, v_day.off <= 0, case when v_day.off <= 0 then 'Διάλυμα χλωρίου' end, case when v_day.off <= 0 then 100 end, case when v_day.off <= 0 then 5 end,
      v_chef, 'demo', case when v_day.off <= -2 then (v_day.day + time '15:30') at time zone 'Europe/Athens' end, case when v_day.off <= -2 then v_manager end,
      case when v_day.off <= -2 then 'Όλες οι καταγραφές πλήρεις.' end
    from public.kitchen_menus m where m.organization_id = v_org and m.weekday = v_day.wd;
    insert into public.kitchen_production_meals (organization_id, production_id, position, meal, diet, dish, portions)
    select v_org, p.id, x.pos, x.meal, x.diet, x.dish, x.portions
    from public.kitchen_productions p
    cross join lateral (values
      (0, 'lunch', 'normal', split_part(p.menu_text, E'\n', 2), 120), (1, 'lunch', 'diabetic', split_part(p.menu_text, E'\n', 2) || ' (χωρίς σάλτσα)', 18),
      (2, 'lunch', 'puree', split_part(p.menu_text, E'\n', 2) || ' (πολτός)', 9), (3, 'dinner', 'normal', split_part(p.menu_text, E'\n', 6), 110)) as x(pos, meal, diet, dish, portions)
    where p.organization_id = v_org and p.production_date = v_day.day and length(btrim(x.dish)) > 0;
  end loop;
end;
$function$;
revoke all on function private.demo_seed_kitchen_days(uuid, date, text, text) from public, anon, authenticated;

-- Raw materials used and the batch withdrawn.
create or replace function private.demo_seed_kitchen_records(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
  d0 date := current_date;
  v_cook text := 'Μαρία Παπαδοπούλου';
  v_chef text := 'Γιώργος Νικολάου';
  v_manager text := 'Ελένη Γεωργίου';
begin
  -- Raw materials from the batches: (day, receipt, position, quantity, dish)
  insert into public.kitchen_material_usage (organization_id, production_id, receipt_item_id, product_id, product_name, lot_label, dish_name, used_on, quantity, unit, recorded_by_name, source)
  select v_org, p.id, i.id, i.product_id, i.product_name, i.batch_code, x.dish, d0 + x.off, x.qty, i.unit, v_cook, 'demo'
  from (values (-6, 'PAR-0001', 0, 6::numeric, 'Κοτόπουλο λεμονάτο'), (-6, 'PAR-0002', 0, 4, 'Ρυζόγαλο'), (-5, 'PAR-0001', 1, 5, 'Μοσχάρι κοκκινιστό με κριθαράκι'), (-5, 'PAR-0001', 0, 5, 'Κοτόσουπα'),
    (-4, 'PAR-0003', 1, 6, 'Ψάρι φιλέτο φούρνου'), (-4, 'PAR-0002', 0, 6, 'Πουρές'), (-3, 'PAR-0001', 0, 7, 'Κεφτεδάκια κοτόπουλο'), (-3, 'PAR-0004', 2, 12, 'Πουρές'),
    (-2, 'PAR-0005', 0, 9, 'Χοιρινή μπριζόλα σχάρας'), (-2, 'PAR-0004', 0, 6, 'Σαλάτα εποχής'), (-1, 'PAR-0003', 0, 12, 'Κοτόπουλο φούρνου με πατάτες'), (-1, 'PAR-0004', 2, 15, 'Κοτόπουλο φούρνου με πατάτες'),
    (-1, 'PAR-0002', 0, 8, 'Ρυζόγαλο'), (0, 'PAR-0005', 1, 10, 'Μοσχάρι λεμονάτο με πουρέ'), (0, 'PAR-0004', 2, 8, 'Πουρές'), (0, 'PAR-0006', 0, 6, 'Γιαούρτι')
  ) as x(off, code, pos, qty, dish)
  join public.kitchen_receipts k on k.organization_id = v_org and k.code = x.code
  join public.kitchen_receipt_items i on i.receipt_id = k.id and i.position = x.pos
  join public.kitchen_productions p on p.organization_id = v_org and p.production_date = d0 + x.off;

  insert into public.kitchen_stock_writeoffs (organization_id, receipt_item_id, written_off_on, quantity, reason, notes, recorded_by_name)
  select v_org, i.id, d0 - 2, 1, 'expired', 'Το υπόλοιπο έληξε· απορρίφθηκε.', v_chef
  from public.kitchen_receipts k join public.kitchen_receipt_items i on i.receipt_id = k.id and i.position = 1 where k.organization_id = v_org and k.code = 'PAR-0001';

  perform private.demo_seed_kitchen_records2(v_org, d0, v_cook, v_manager);
end;
$function$;
revoke all on function private.demo_seed_kitchen_records(uuid, uuid) from public, anon, authenticated;

-- Heat parameters.
create or replace function private.demo_seed_kitchen_records2(v_org uuid, d0 date, v_cook text, v_manager text)
returns void language plpgsql set search_path = ''
as $function$
begin
  insert into public.kitchen_thermal_processes (organization_id, production_id, process_date, process_time, dish_name, cooking_temp, chill_temp, chill_minutes, reheat_temp, frying_temp, corrective_action, recorded_by_name, source)
  select v_org, p.id, d0 + x.off, x.t::time, x.dish, x.cook, x.chill, x.mins, x.reheat, x.fry, x.action, v_cook, 'demo'
  from (values (-6, '12:10', 'Κοτόπουλο λεμονάτο', 86::numeric, null::numeric, null::integer, null::numeric, null::numeric, null::text), (-6, '10:30', 'Ρυζόγαλο', 88, 6, 75, null, null, null),
    (-5, '12:00', 'Μοσχάρι κοκκινιστό', 89, null, null, null, null, null), (-5, '18:20', 'Κοτόσουπα', 92, null, null, 84, null, null), (-4, '12:15', 'Ψάρι φιλέτο φούρνου', 82, null, null, null, null, null),
    (-3, '11:40', 'Κεφτεδάκια κοτόπουλο', 84, 5, 90, null, null, null), (-3, '12:05', 'Πατάτες τηγανητές', null, null, null, null, 175, null), (-2, '12:20', 'Χοιρινή μπριζόλα σχάρας', 80, null, null, null, null, null),
    (-1, '12:10', 'Κοτόπουλο φούρνου με πατάτες', 71, null, null, null, null, 'Το μαγείρεμα συνεχίστηκε 15′ ως τους 84 °C και ξαναμετρήθηκε πριν τη διανομή.'), (-1, '10:20', 'Ρυζόγαλο', 87, 7, 60, null, null, null),
    (0, '11:55', 'Μοσχάρι λεμονάτο', 85, null, null, null, null, null), (0, '18:10', 'Κοτόσουπα (αναθέρμανση)', null, null, null, 79, null, null)
  ) as x(off, t, dish, cook, chill, mins, reheat, fry, action)
  join public.kitchen_productions p on p.organization_id = v_org and p.production_date = d0 + x.off;

  perform private.demo_seed_kitchen_records3(v_org, d0, v_cook, v_manager);
end;
$function$;
revoke all on function private.demo_seed_kitchen_records2(uuid, date, text, text) from public, anon, authenticated;

-- Pureeing and defrosts.
create or replace function private.demo_seed_kitchen_records3(v_org uuid, d0 date, v_cook text, v_manager text)
returns void language plpgsql set search_path = ''
as $function$
begin
  insert into public.kitchen_pureeing (organization_id, production_id, pureed_on, method, product_name, visual_check, blade_check, recorded_by_name, source)
  select v_org, p.id, p.production_date, case when x.n % 3 = 2 then 'sieving' else 'pureeing' end, x.dish, true, true, v_cook, 'demo'
  from (values (-6, 0, 'Κοτόπουλο λεμονάτο'), (-5, 1, 'Μοσχάρι κοκκινιστό'), (-4, 2, 'Ψάρι φιλέτο'), (-3, 3, 'Κεφτεδάκια κοτόπουλο'), (-2, 4, 'Χοιρινό με πουρέ'), (-1, 5, 'Κοτόπουλο φούρνου'), (0, 6, 'Μοσχάρι λεμονάτο')) as x(off, n, dish)
  join public.kitchen_productions p on p.organization_id = v_org and p.production_date = d0 + x.off;

  insert into public.kitchen_defrosting (organization_id, receipt_item_id, product_id, product_name, quantity, unit, method, started_at, start_temp, ended_at, end_temp, corrective_action, verified_at, verified_by_name, recorded_by_name, source)
  select v_org, i.id, i.product_id, i.product_name, x.qty, 'kg', x.method, (d0 + x.s_off + x.s_t::time) at time zone 'Europe/Athens', x.s_temp,
    case when x.e_off is null then null else (d0 + x.e_off + x.e_t::time) at time zone 'Europe/Athens' end, x.e_temp, x.action,
    case when x.v_off is null then null else (d0 + x.v_off + x.v_t::time) at time zone 'Europe/Athens' end, case when x.v_off is null then null else v_manager end, v_cook, 'demo'
  from (values (0, 12::numeric, 'refrigerator', -3, '20:00', -18::numeric, -2, '08:30', -1::numeric, null::text, -2, '09:10'), (1, 6, 'refrigerator', -5, '20:10', -19, -4, '08:00', 0, null, -4, '09:00'),
    (0, 10, 'refrigerator', -1, '20:15', -17, 0, '08:00', -2, null, null, null),
    (1, 5, 'running_water', 0, '09:30', -18, 0, '11:00', 7, 'Μαγειρεύτηκε αμέσως (πυρήνας 82 °C)· η απόψυξη σε νερό γίνεται μόνο για άμεσο μαγείρεμα.', null, null),
    (0, 8, 'refrigerator', 0, '20:00', -18, null, null, null, null, null, null)
  ) as x(pos, qty, method, s_off, s_t, s_temp, e_off, e_t, e_temp, action, v_off, v_t)
  join public.kitchen_receipts k on k.organization_id = v_org and k.code = 'PAR-0003'
  join public.kitchen_receipt_items i on i.receipt_id = k.id and i.position = x.pos;
end;
$function$;
revoke all on function private.demo_seed_kitchen_records3(uuid, date, text, text) from public, anon, authenticated;

-- The Demo kitchen: the catalogue, menus, receipts and days, then the day's records.
create or replace function private.demo_seed_kitchen(p_organization_id uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  perform private.demo_seed_kitchen_base(p_organization_id, p_actor);
  perform private.demo_seed_kitchen_records(p_organization_id, p_actor);
end;
$function$;
revoke all on function private.demo_seed_kitchen(uuid, uuid) from public, anon, authenticated;

-- The Demo data pack now ends with the kitchen. Otherwise unchanged from 20261115100000.
create or replace function private.demo_seed_data(p_organization_id uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  v_org uuid := p_organization_id;
begin
  if p_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = v_org and o.is_demo) then
    raise exception 'Only Demo organizations can be filled with Demo data' using errcode = '42501';
  end if;
  perform set_config('limoxis.test_reset', 'on', true);
  perform private.demo_seed_departments_patients(v_org, p_actor);
  perform private.demo_seed_surveillance(v_org, p_actor);
  perform private.demo_seed_laboratory(v_org, p_actor);
  perform private.demo_seed_microbiology(v_org, p_actor);
  perform private.demo_seed_susceptibility(v_org, p_actor);
  perform private.demo_seed_hand_hygiene_employees(v_org, p_actor);
  perform private.demo_seed_patient_days(v_org, p_actor);
  perform private.demo_seed_incidents(v_org, p_actor);
  perform private.demo_seed_capa(v_org, p_actor);
  perform private.demo_seed_documents(v_org, p_actor);
  perform private.demo_seed_committees(v_org, p_actor);
  perform private.demo_seed_controls(v_org, p_actor);
  perform private.demo_seed_training(v_org, p_actor);
  perform private.demo_seed_pharmacy(v_org, p_actor);
  perform private.demo_seed_occupational_health(v_org, p_actor);
  perform private.demo_seed_prevention(v_org, p_actor);
  -- Full, coherent data in every screen (20261018120000).
  perform private.demo_seed_clinical(v_org, p_actor);
  perform private.demo_seed_current_month(v_org, p_actor);
  perform private.demo_seed_quality(v_org, p_actor);
  perform private.demo_seed_people_clinical_scales(v_org, p_actor);
  perform private.demo_seed_people_training(v_org, p_actor);
  perform private.demo_seed_people_employees(v_org, p_actor);
  perform private.demo_seed_people_occupational_health(v_org, p_actor);
  perform private.demo_seed_governance(v_org, p_actor);
  -- The kitchen (HACCP), 20261123110200.
  perform private.demo_seed_kitchen(v_org, p_actor);
  return jsonb_build_object(
    'ok', true,
    'departments', (select count(*) from public.departments x where x.organization_id = v_org),
    'patients', (select count(*) from public.patients x where x.organization_id = v_org),
    'surveillanceCases', (select count(*) from public.surveillance_cases x where x.organization_id = v_org),
    'laboratorySamples', (select count(*) from public.laboratory_samples x where x.organization_id = v_org),
    'microbiologyResults', (select count(*) from public.microbiology_results x where x.organization_id = v_org),
    'handHygieneSessions', (select count(*) from public.hand_hygiene_sessions x where x.organization_id = v_org),
    'employees', (select count(*) from public.employees x where x.organization_id = v_org),
    'incidents', (select count(*) from public.quality_incidents x where x.organization_id = v_org),
    'capa', (select count(*) from public.quality_capa_actions x where x.organization_id = v_org),
    'documents', (select count(*) from public.controlled_documents x where x.organization_id = v_org),
    'committees', (select count(*) from public.committees x where x.organization_id = v_org),
    'controls', (select count(*) from public.control_definitions x where x.organization_id = v_org),
    'controlExecutions', (select count(*) from public.control_executions x where x.organization_id = v_org),
    'trainingPrograms', (select count(*) from public.training_programs x where x.organization_id = v_org),
    'trainingAssignments', (select count(*) from public.training_assignments x where x.organization_id = v_org),
    'antibioticDispensing', (select count(*) from public.antibiotic_dispensing_periods x where x.organization_id = v_org),
    'vaccinations', (select count(*) from public.employee_vaccinations x where x.organization_id = v_org),
    'occupationalVisits', (select count(*) from public.occupational_health_visits x where x.organization_id = v_org),
    'exposures', (select count(*) from public.occupational_exposure_incidents x where x.organization_id = v_org),
    'wasteRecords', (select count(*) from public.waste_measurements x where x.organization_id = v_org),
    'antisepticRecords', (select count(*) from public.antiseptic_consumption_periods x where x.organization_id = v_org),
    'bundleAudits', (select count(*) from public.prevention_bundle_assessments x where x.organization_id = v_org),
    'kitchenReceipts', (select count(*) from public.kitchen_receipts x where x.organization_id = v_org)
  );
end;
$function$;

revoke all on function private.demo_seed_data(uuid, uuid) from public, anon, authenticated;

-- The Demos that exist now get their kitchen.
select private.demo_seed_kitchen(o.id, null) from public.organizations o where o.is_demo;
