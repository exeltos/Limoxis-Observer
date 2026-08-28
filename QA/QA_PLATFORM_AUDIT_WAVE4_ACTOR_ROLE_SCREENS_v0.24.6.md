# Platform Audit — Wave 4: Authenticated Actor + Role/Screen Access — v0.24.6

## Authenticated actor provenance
Removed UI-level `Current user` placeholders from active mutation flows.

Authenticated user identity now feeds:
- Laboratory sample creation
- Laboratory receive/start/process/result/validation
- AST edits
- critical-result communication
- employee-screening laboratory workflow
- environmental laboratory workflow
- laboratory finalization/reopen/document review
- Quality record creation
- new patient surveillance flow
- Surveillance registry creation/follow-up
- patient clinical record edits, reassessment, therapy, isolation and outcome
- employee surveillance creation/bulk creation
- environmental surveillance creation

Shared primitive:
- `useAuditActor()` → resolves the signed-in profile/user through `auditActorFromAuth`.

Data-layer fallback values are now `Unknown actor` rather than pretending to know the current user.
Seed/demo events are explicitly labelled `Demo seed`.

## Role / screen audit
Added `tools/check-role-screen-access.mjs`.

Explicit assertions cover:
- Laboratory
- Quality Manager
- Occupational Physician
- HR
- Doctor Reviewer
- Department Manager
- Department User
- Pharmacy
- Committee Secretariat

The audit verifies both positive access and important non-inheritance boundaries.

Hospital Admin remains separately covered by `check-admin-full-access.mjs`.

## Security/governance position
Frontend role checks are UX enforcement and workflow protection only.
Production Supabase must enforce the same boundaries with RLS and server-side actor identity.

## Open findings
- Continue replacing module-specific role conditionals with capability-based policy where safe.
- Standardize createdAt/createdBy/updatedAt/updatedBy object shape across every domain record.
- Persist audit actor IDs, not only display names, in Supabase.
- Continue finalized/reopen lifecycle review in remaining active modules.
- Sidebar information architecture is intentionally deferred for a dedicated frequency-based pass.
