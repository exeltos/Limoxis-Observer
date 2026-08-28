# Committees Governance Workspace — v0.25.0

Implemented:
- committee registry with search/status filters and KPI summary
- committee detail workspace
- members and governance roles
- meetings / agendas / minutes lifecycle
- decisions and accountable actions with owner, due date, priority, status
- governed minutes finalization with reason and audit actor
- history / provenance trail
- role capability protection via VIEW_COMMITTEES / MANAGE_COMMITTEES
- demo/local persistence via localStorage
- CSV export / print
- production storage boundary documented for Supabase Storage

Production backend requirements still to wire:
- normalized committee/member/meeting/decision/action tables
- RLS by organization and committee capability
- immutable finalized minutes + correction events
- object storage and document retention
- server-side audit actor IDs
