# Platform Audit — Wave 3: Lifecycle, Roles & Screen Access — v0.24.1

## Critical role decision
Hospital Admin is now an organization-level product administrator, not a partial operational role.

A Hospital Admin can work directly in every hospital module without changing to Laboratory,
Occupational Physician, Pharmacy, Infection Control or Quality role first.

Hospital Admin receives every product capability except the two cross-tenant Platform Owner
capabilities:
- VIEW_PLATFORM
- MANAGE_PLATFORM

Organization scope remains enforced. This does not turn Hospital Admin into a cross-hospital
Platform Owner.

Sensitive employee-health access is enabled for Hospital Admin so the administrator can test
and operate Employee Surveillance / Occupational Health without role switching.

Role Preview remains available only as a simulation/testing tool. It is not required to unlock
administrator functionality.

## Automated role/screen audit
Added `tools/check-admin-full-access.mjs`.

It scans capability references across `src/features` and fails if any feature capability used by
a screen is missing from Hospital Admin (excluding platform-only capabilities).

Current result:
- 35 feature capabilities audited
- Hospital Admin: PASS
- organization scope retained
- platform administration remains restricted

The product permission suite was expanded from 15 to 22 assertions and now explicitly checks:
- Laboratory management
- laboratory result validation
- laboratory reopen/correction
- antimicrobial therapy
- Occupational Health
- Pharmacy
- Platform Owner separation

## Detail-route scope enforcement
Added direct-record scope checks to:
- Patients / Surveillance clinical record
- Employees
- Laboratory
- Quality
- Prevention

This closes an important UX/security gap: hiding a row in a scoped registry is not enough if the
same record can still be opened by typing its URL.

Laboratory employee-screening records additionally require sensitive employee-health access.

Frontend checks remain UX protection only. Production Supabase RLS must independently enforce
the same rules.

## Non-destructive clinical/quality lifecycle
### Quality
- closed/completed/cancelled records are treated as finalized
- editing a finalized record requires a reason
- correction adds actor, timestamp and reason to history
- "delete" is converted to governed void/cancel
- voided records remain in source history but disappear from the active registry
- attachments are locked on finalized records

### Prevention
- editing a recorded Prevention measurement now requires a correction reason
- correction stores actor / actor id / timestamp / revision event
- physical delete from Prevention detail was removed
- cancellation is now a governed void with mandatory reason
- voided records remain auditable and are excluded from the active registry

### Clinical Surveillance
Erroneous active surveillance deletion no longer destroys the source clinical case.
The record is marked `lifecycleStatus: voided`, with actor/reason/timestamp and timeline event.
The active registry projection can be removed while the evidence remains auditable.

## Shared governance primitives
Added:
- `src/core/audit/actor.js`
- `src/design-system/GovernedReasonDialog.jsx`

These provide a common actor/event shape and one visual pattern for reason-required corrections,
reopenings and void actions.

## Still open for next waves
1. Replace remaining display actor strings (`Current user`) with authenticated actor metadata in
   every Laboratory/Surveillance mutation.
2. Normalize createdAt/createdBy/updatedAt/updatedBy across all domain records.
3. Apply immutable/finalized guards to remaining domain modules.
4. Persist lifecycle events in Supabase audit tables and enforce them server-side.
5. Continue role-by-screen review for non-admin roles: Infection Control, Laboratory, Department,
   Occupational Physician, Pharmacy, Quality, Committee, Doctor Reviewer and HR.
6. Placeholder modules remain a separate HIGH finding: LIRA, Training, Committees, Documents,
   Records.
