# v0.47.4 Delete / Test Reset Fix

Fixes test deletion when a patient/surveillance case contains finalized microbiology results with AST evidence.

The normal immutability rule for finalized AST remains active. The bypass is transaction-local and is enabled only inside the authorized test-reset RPC functions after Platform Owner / Hospital Admin authorization checks.

No duplicate tables or RLS policies are created.
