-- «Χάρτης τμημάτων» (20261231638000): η νέα συνάρτηση δόθηκε μόνο στον authenticated· το Supabase δίνει από προεπιλογή
-- EXECUTE και στον anon/public. Το τρέχει ο ιδιοκτήτης στο SQL Editor.
revoke all on function public.hospital_department_period_matrix(uuid, date, date, date, date) from public, anon;
