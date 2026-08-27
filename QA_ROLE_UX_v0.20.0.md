# Role & Permission UX Baseline — v0.20.0

This release establishes the central frontend role/scope contract that the final Supabase RLS must mirror.

## Rules
- Navigation and routes remain capability-gated.
- Record scope is centralized: platform / organization / department / self.
- Sensitive employee-health visibility is explicitly separated from generic employee-directory access.
- HR and Hospital Admin can administer employee directory data but are not granted sensitive employee-health visibility by the UX policy.
- Laboratory, Infection Control and Occupational Physician are explicitly marked for employee screening/health workflow visibility.
- Department roles are department-scoped.
- Platform Owner is platform-scoped but does not automatically receive sensitive clinical employee-health UI.
- Role preview uses the same policy contract and does not inherit the previewing administrator's add-ons.

## Supabase finalization (required before production)
Mirror the same organization/department/self scopes in RLS for profiles, memberships, patients, surveillance, laboratory samples, employee health, occupational health, prevention records, documents/storage and audit tables. UI hiding is not a security boundary.
