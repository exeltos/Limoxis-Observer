-- Να το τρέξει ο ιδιοκτήτης στο SQL Editor (ο agent δεν εκτελεί revoke).
-- Ο νέος πίνακας μηνιαίων τιμών στόχων δεν δίνεται σε ανώνυμους χρήστες, όπως όλοι οι πίνακες ποιότητας.
revoke all on public.quality_objective_values from anon;
