-- Κατηγορία ατόμου στο Προσωπικό: Εργαζόμενος (όλοι οι υπάρχοντες), Ιατρός συνεργάτης, Εξωτερικός συνεργάτης.
-- Οι συνεργάτες επιλέγονται σε επιτροπές, συναντήσεις κ.λπ., αλλά δεν μετρούν στο προσωπικό του νοσοκομείου
-- (ενεργοί εργαζόμενοι, κάλυψη εμβολιασμού, δείκτες ανθρώπινου δυναμικού).
alter table public.employees add column if not exists staff_category text not null default 'employee';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employees_staff_category_check' and conrelid = 'public.employees'::regclass) then
    alter table public.employees add constraint employees_staff_category_check check (staff_category in ('employee', 'physician', 'external'));
  end if;
end $$;

create index if not exists employees_org_staff_category_idx on public.employees (organization_id, staff_category);

-- Οι μετρήσεις του προσωπικού κρατούν μόνο τους εργαζόμενους.
do $$
declare
  fn record;
  def text;
  changed text;
begin
  for fn in
    select * from (values
      ('public.analysis_people_metrics(uuid,date,date,uuid)', $a$coalesce(e.employment_status,'active')='active'$a$, $b$coalesce(e.employment_status,'active')='active' and e.staff_category='employee'$b$, 1),
      ('public.dashboard_metrics(uuid,uuid[])', $a$x.employment_status = 'active'$a$, $b$x.employment_status = 'active' and x.staff_category = 'employee'$b$, 2),
      ('private.indicator_metric_snapshot(uuid,date,date,uuid)', $a$e.employment_status='active'$a$, $b$e.employment_status='active' and e.staff_category='employee'$b$, 2)
    ) v(sig, old_text, new_text, expected)
  loop
    def := pg_get_functiondef(fn.sig::regprocedure);
    if position(fn.new_text in def) > 0 then continue; end if;
    if (length(def) - length(replace(def, fn.old_text, ''))) / length(fn.old_text) <> fn.expected then
      raise exception 'unexpected occurrences of % in %', fn.old_text, fn.sig;
    end if;
    changed := replace(def, fn.old_text, fn.new_text);
    execute changed;
  end loop;
end $$;

-- Ο νυχτερινός συγχρονισμός γράφει και τον «Υπεύθυνο / διοργανωτή» της εκπαίδευσης: το τμήμα που την οργάνωσε.
do $$
declare def text;
begin
  def := pg_get_functiondef('private.fm_sync_training()'::regprocedure);
  if position('trainer, owner, start_date' in def) = 0 then
    if position('title, status, trainer, start_date' in def) = 0
       or position($a$private.fm_text(s.d->>'Train_Instructor'), nullif(s.d->>'Train_StartDay', '')::date$a$ in def) = 0 then
      raise exception 'fm_sync_training has an unexpected shape';
    end if;
    def := replace(def, 'title, status, trainer, start_date', 'title, status, trainer, owner, start_date');
    def := replace(def, $a$private.fm_text(s.d->>'Train_Instructor'), nullif(s.d->>'Train_StartDay', '')::date$a$,
      $b$private.fm_text(s.d->>'Train_Instructor'), (select dp.name from public.departments dp where dp.id = private.fm_department(s.d->>'CreatedBy')), nullif(s.d->>'Train_StartDay', '')::date$b$);
    execute def;
  end if;
end $$;
