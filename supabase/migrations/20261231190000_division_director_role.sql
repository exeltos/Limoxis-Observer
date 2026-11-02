-- Division Director («Διευθυντής Διεύθυνσης»): sees the candidates of the positions that
-- belong to his / her division (e.g. the Nursing Director sees only nursing positions) and
-- gives an opinion on them. The value is added on its own: a new enum value cannot be used
-- in the transaction that adds it.
alter type public.app_role add value if not exists 'division_director';
