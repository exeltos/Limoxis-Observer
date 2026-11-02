-- ΚΕΝΕΣ ΗΜΕΡΕΣ στα ημερήσια φύλλα του ΙΑΣΩ (ζητήθηκε από τον ιδιοκτήτη 31/10/2026): εγγραφές όπου ΟΛΕΣ οι στήλες τιμών είναι κενές
-- (οι 1ες των μηνών που το FileMaker δεν είχε εγγραφή, και μια ημέρα του ΤΕΠ χωρίς τιμές). Μία ημέρα με 0 δεν είναι κενή και ΔΕΝ διαγράφεται.
-- ΤΡΕΧΕΙ ΑΠΟ ΤΟΝ ΙΔΙΟΚΤΗΤΗ στο SQL Editor (περιέχει delete, δεν εκτελείται από τον agent). Αντίγραφα των μηνιαίων εγγραφών υπάρχουν στα bk_register_*_20261031.
-- Αναμενόμενες γραμμές (έλεγχος ανάγνωσης 31/10/2026): ΤΕΠ 2 · Αίθουσα Τοκετών 14 · Οφθαλμολογικό 13 · Ενδοσκοπικό 15 (σύνολο 44).
-- Η καθεμιά εντολή δείχνει με returning πόσες διέγραψε· αν κάποιο πλήθος διαφέρει, κάνε rollback αντί για commit.
begin;

delete from public.register_emergency_f6ceb2a5
where surgical__morning is null and surgical__afternoon is null and surgical__night is null and urgent__morning is null and urgent__afternoon is null and urgent__night is null
  and admissions__morning is null and admissions__afternoon is null and admissions__night is null and dressings__morning is null and dressings__afternoon is null and dressings__night is null
  and septic__morning is null and septic__afternoon is null and septic__night is null and assessments__morning is null and assessments__afternoon is null and assessments__night is null
  and checkup__morning is null and checkup__afternoon is null and checkup__night is null and preop__morning is null and preop__afternoon is null and preop__night is null
  and left_without_seen__morning is null and left_without_seen__afternoon is null and left_without_seen__night is null and revisit_72h__morning is null and revisit_72h__afternoon is null and revisit_72h__night is null
  and transfers__morning is null and transfers__afternoon is null and transfers__night is null
returning period_start;   -- 2

delete from public.register_deliveryroom_c1b3757d
where vaginal__count is null and cs__count is null and vbac__count is null and multiple_vaginal__count is null and multiple_cs__count is null and born_before_arrival__count is null
  and hysteroscopy__count is null and septic__count is null and pregnancy_monitoring__count is null and cerclage__count is null
returning period_start;   -- 14

delete from public.register_ophthalmology_bbea9bde
where cataract__count is null and vitrectomy__count is null and intravitreal__count is null and other_local__count is null
returning period_start;   -- 13

delete from public.register_endoscopy_da85fba4
where gastroscopy__count is null and colonoscopy__count is null and gastrostomy__count is null and cystoscopy__count is null and bronchoscopy__count is null
  and ercp__count is null and eus__count is null and ebus__count is null
returning period_start;   -- 15

commit;   -- ή rollback; αν κάποιο πλήθος δεν είναι το αναμενόμενο
