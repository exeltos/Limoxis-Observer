-- Ταχύτητα δεικτών (ιδιοκτήτης, 14/11/2026). Ο υπολογισμός ενός μήνα (indicator_metric_snapshot) φιλτράριζε τα δείγματα
-- με «l.collected_at::date between p_from and p_to»: η μετατροπή σε ημερομηνία δεν αφήνει τη βάση να χρησιμοποιήσει
-- ευρετήριο, οπότε ξεκινούσε από όλα τα θετικά αποτελέσματα του νοσοκομείου (~4.300) και έψαχνε το δείγμα του καθενός.
-- Τώρα το ίδιο φίλτρο ως εύρος χρόνου (από τα μεσάνυχτα του p_from έως πριν από τα μεσάνυχτα της επόμενης του p_to,
-- στην ίδια ζώνη ώρας της σύνδεσης όπως πριν) με ευρετήριο (organization_id, collected_at).
-- Έλεγχος πριν την εφαρμογή (ΙΑΣΩ, 98 περίοδοι: 24 μήνες × όλο το νοσοκομείο και 3 τμήματα, 2025 και 2026): ίδιο
-- αποτέλεσμα σε όλες· σελίδες μνήμης ανά μήνα ~31.000–39.000 → ~6.300, χρόνος ~51–86 → ~25–34 ms.
create index if not exists laboratory_samples_org_collected_idx on public.laboratory_samples(organization_id, collected_at);

do $$
declare def text;
begin
  select pg_get_functiondef('private.indicator_metric_snapshot(uuid,date,date,uuid)'::regprocedure) into def;
  if position('l.collected_at::date between p_from and p_to' in def) = 0 then return; end if;
  def := replace(def,
    'l.collected_at::date between p_from and p_to',
    'l.collected_at>=p_from::timestamptz and l.collected_at<(p_to+1)::timestamptz');
  execute def;
end $$;
