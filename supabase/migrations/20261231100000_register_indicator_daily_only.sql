-- Δείκτες ημερήσιων φύλλων: «μόνο από τα ημερήσια φύλλα» (οι μήνες με ένα μηνιαίο σύνολο δεν μετράνε),
-- π.χ. «Μέσος αριθμός πράξεων ανά ημέρα λειτουργίας» και «Ημέρες με καταχώριση».
alter table public.department_register_indicators add column if not exists daily_only boolean not null default false;
comment on column public.department_register_indicators.daily_only is 'Sheet indicator read only from the daily sheets (not from a month''s single total).';
