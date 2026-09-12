# v0.41.0 — Surveillance Center / Supabase pass

- Production Surveillance remains backed by Supabase services (`surveillance_cases`, `patients`, `laboratory_samples`, departments and related clinical tables).
- Platform Owner no longer lands on a misleading empty Surveillance Center when no organization context is selected.
- Platform Owner receives an explicit organization-context chooser and remains Platform Owner after entering an organization.
- A compact organization switcher is available in the Surveillance Center header.
- Empty registries now mean the selected organization actually has no rows, rather than “no tenant selected”.
- No new npm dependency was added.
