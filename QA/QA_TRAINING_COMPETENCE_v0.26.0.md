# QA — Training & Competence v0.26.1 — Central Design System Alignment

## Scope
First functional Training module for the Limoxis Observer rebuild. The module intentionally follows the Observer design system and does not port legacy Healthcare Suite UI.

## Functional model
- Training programmes with owner, audience, delivery method and completion period.
- Optional assessment requirement with pass threshold.
- Competence validity period and renewal visibility.
- Individual assignments with due dates and calculated overdue state.
- Completion recording with attendance, assessment result and competence outcome.
- Failed assessment remains visible and is flagged for retraining/reassessment rather than being silently treated as complete competence.
- Competence evidence/certificates remain linked to the underlying assignment.
- Role-aware presentation: management view, department-manager view and employee self-service view.

## Governance intent
- ISO 9001:2015 clause 7.2 principle: retain appropriate evidence of competence.
- ISO 10015:2019 principle: manage competence and people development as a system, not as attendance-only training records.
- JCI Hospital 8th Edition alignment intent: support staff qualification/education/competency evidence and recurring reassessment workflows without exposing accreditation terminology as extra daily fields.

## UX decisions
- Three management tabs only: Programmes / Assignments & participation / Competence & expiry.
- Two employee tabs only: My training / Certificates.
- Search + status/category filtering stays inside the registry pattern.
- The user records only operational facts; governance metadata is derived or retained by the system where possible.
- Common Observer date fields, status badges, page actions and dialogs are reused.
- Training introduces no feature-specific visual system: tabs use `canonical-module-tabs`, KPIs use `module-summary-strip` / `module-summary-metric`, forms use the shared `entry-grid` / `field` contract, and dialogs use `ObserverDialog`.
- All `.training-*` CSS was removed. Visual changes to global tokens/components now propagate to Training automatically.

## Production follow-up
- Replace demo/local state with normalized Supabase training tables and RLS.
- Resolve the authenticated user to the canonical employee record instead of demo EMP-001.
- Connect employee training tab to the same training source of truth.
- Add controlled programme assignment to departments/roles/employees.
- Add immutable audit events for completion corrections and competency reassessment.
- Connect certificate/document evidence to the central storage/document layer.

## Verification
- `tools/check-training-foundation.mjs` validates required Training v1 structural elements.
- Full Vite build could not be executed in the isolated packaging runtime because npm dependency installation did not complete.
