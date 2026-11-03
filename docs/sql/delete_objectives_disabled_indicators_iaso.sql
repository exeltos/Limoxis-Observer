-- ΙΑΣΩ: οι στόχοι 2026 που δημιουργήθηκαν κατά λάθος για δείκτες που το νοσοκομείο έχει απενεργοποιήσει
-- (αντοχές amr-*, πληρότητα αναφοράς ΕΟΔΥ): QO-2026-031 έως 038 και QO-2026-052. Δεν έχουν δεδομένα ούτε τιμές.
-- Τρέξε το στο SQL Editor του Supabase.
begin;
select set_config('request.jwt.claims', '{"sub":"84066ee0-57b7-4cae-9186-09e491d3ea6d","role":"authenticated"}', true);
delete from public.quality_objectives
where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and year = 2026
  and code in ('QO-2026-031','QO-2026-032','QO-2026-033','QO-2026-034','QO-2026-035','QO-2026-036','QO-2026-037','QO-2026-038','QO-2026-052')
  and platform_indicator_key in ('amr-acinetobacter-meropenem-rate','amr-ecoli-ceftriaxone-rate','amr-enterobacter-ceftriaxone-rate','amr-enterococcus-vancomycin-rate','amr-klebsiella-meropenem-rate','amr-proteus-ceftriaxone-rate','amr-pseudomonas-meropenem-rate','amr-saureus-oxacillin-rate','eody-reporting-completeness');
commit;
-- Επιβεβαίωση (μόνο ανάγνωση): 53 στόχοι 2026 και κανένας για απενεργοποιημένο δείκτη.
select count(*) from public.quality_objectives where organization_id = '7972f286-e8b8-4bbf-aa97-cf9a3d1375bd' and year = 2026;
