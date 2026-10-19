-- Hospital Director: a read-only role that sees the whole hospital through the
-- Executive dashboard. The value is added on its own: a new enum value cannot
-- be used in the transaction that adds it.
alter type public.app_role add value if not exists 'hospital_director';
