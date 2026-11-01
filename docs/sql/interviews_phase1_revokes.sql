-- Συνεντεύξεις φάση 1: αφαίρεση δικαιωμάτων που δεν χρειάζονται (τρέχει ο ιδιοκτήτης στο SQL Editor).
-- Τα revoke δεν εκτελούνται από τον agent. Οι συναρτήσεις ελέγχουν ήδη auth.uid() και τον ρόλο,
-- και ο πίνακας γνωμών έχει RLS χωρίς πολιτική (επιστρέφει 0 γραμμές), αλλά αυτά κλείνουν και το δικαίωμα.
revoke all on function public.hr_division_candidates(uuid) from public, anon;
revoke all on function public.hr_candidate_opinions(uuid) from public, anon;
revoke all on function public.hr_save_opinion(uuid, text, text, boolean) from public, anon;
revoke all on function private.hr_my_divisions(uuid) from public, anon, authenticated;
revoke all on function private.hr_opinion_role(uuid, uuid) from public, anon, authenticated;
revoke all on public.hr_interview_opinions from anon, authenticated;
revoke all on public.hr_divisions, public.hr_division_categories, public.hr_division_members, public.hr_interview_settings from anon;

-- Έλεγχος (μόνο ανάγνωση):
-- select routine_name, grantee from information_schema.routine_privileges
--  where routine_schema in ('public','private') and routine_name in ('hr_division_candidates','hr_candidate_opinions','hr_save_opinion','hr_my_divisions','hr_opinion_role');
