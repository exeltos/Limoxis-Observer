# Canonical authorization model

Status: **Accepted for capability-matrix implementation**  
Scope: frontend authorization, role preview, Supabase authorization and RLS

## Decisions

1. The product has 13 immutable system-role IDs: `platform_owner`,
   `hospital_admin`, `infection_control_lead`, `infection_control_member`,
   `department_manager`, `department_user`, `laboratory`, `doctor_reviewer`,
   `occupational_physician`, `hr_office`, `quality_manager`,
   `committee_secretariat`, and `pharmacy`.
2. `platform_owner` is a platform identity attribute, not an organization
   membership role. It never grants an implicit hospital-record RLS bypass.
3. Each active organization membership has exactly one primary system or custom
   role. Supplemental authority comes from grants, add-ons and assignments—not
   by unioning multiple primary roles.
4. Data scopes are `PLATFORM`, `ORGANIZATION`, `DEPARTMENT`, and `SELF`.
   `OWNER` and `ASSIGNED` are record relationships evaluated after scope.
   `ADD_ON` is a supplemental grant and is neither a scope nor a role.
5. The authorization decision order is:

   `capability -> data scope -> record relationship -> lifecycle -> action`.

6. Governance actions (`FINALIZE`, `APPROVE`, `VALIDATE`, `REOPEN`, `VOID`,
   `ARCHIVE`, `PUBLISH`, `SUPERSEDE`, `DELETE_DRAFT`) are explicit capabilities.
   A broad `MANAGE` capability does not imply them.
7. Governed evidence is never physically deleted after finalization. Drafts may
   be deleted, finalized evidence may be voided with reason and audit metadata,
   and controlled records may be archived or superseded.
8. Role preview is a read-only presentation simulation. Authorization for every
   server operation uses the actor's real identity and grants.

## Capability catalogue contract

Every capability definition must provide:

- stable `id`, `domain`, and `actionType`;
- Greek and English descriptions;
- `allowedScopes`, `defaultScope`, and `maximumScope`;
- sensitivity classification and allowed role families;
- custom-role classification: `STANDARD`, `RESTRICTED`, or `SYSTEM_ONLY`;
- add-on eligibility;
- ownership and assignment requirements;
- lifecycle/governance semantics; and
- the RLS enforcement mode expected for the capability.

Platform administration, tenant bypass, organization ownership, system-role
administration, cross-tenant access and platform audit administration are
`SYSTEM_ONLY`. In the first production version, `MANAGE_USERS`, `MANAGE_ROLES`
and `MANAGE_ORGANIZATION` are also `SYSTEM_ONLY` and cannot be assigned through
the custom-role editor.

Sensitive capabilities require both the capability and an allowed role family.
At minimum, Occupational Health, employee clinical surveillance, protected
patient content and security administration are sensitive domains.

## Scope invariants

- `PLATFORM` applies only to platform resources.
- `ORGANIZATION` never crosses the current tenant boundary and grants access
  only inside the capability's domain.
- `DEPARTMENT` is resolved exclusively from stable department IDs attached to
  the current membership and may contain multiple departments.
- `SELF` requires a stable `auth.users.id -> membership -> employee_id` link.
- `OWNER` never overrides lifecycle rules.
- `ASSIGNED` requires an explicit, active assignment as well as the capability.
- A grant or custom role cannot raise a capability above its `maximumScope`.
- A department-scoped primary role cannot be escalated to organization scope by
  adding a custom capability.

For roles such as `doctor_reviewer` and `committee_secretariat`, `ASSIGNED` is
not stored as a data scope. Their matrix rows use an appropriate tenant data
scope plus `requiresAssignment: true`.

## Role boundaries

- Platform Owner administers the platform without acting as a hospital operator.
- Hospital Admin administers organization configuration and workforce identity,
  but receives neither protected clinical content nor Occupational Health by
  default.
- IPC Lead and IPC Member are organization-wide only inside IPC domains; lead
  governance actions remain separate capabilities.
- Department Manager and Department User remain inside assigned departments.
- Laboratory capabilities are split into sample entry, processing, result entry,
  validation, critical communication, AMR classification, reopen and finalization.
- Doctor Reviewer requires explicit assignment unless a separately governed
  organization-wide clinical grant exists.
- Occupational Physician is organization-wide only inside the sensitive
  Occupational Health domain.
- HR Office administers non-medical employee data and never inherits employee
  clinical access.
- Quality Manager is organization-wide inside Quality/governance domains and
  receives no implicit patient or Occupational Health access.
- Committee Secretariat requires assignment to each committee.
- Pharmacy is organization-wide only inside pharmacy and antimicrobial
  stewardship domains.

## Source-of-truth implementation

The implementation is split into four dependency-free specification modules:

1. `scopeTypes.js` — scope and record-relationship constants and validation;
2. `capabilityCatalogue.js` — canonical capability metadata;
3. `systemRoleMatrix.js` — immutable system role × capability rows; and
4. `permissionEngine.js` — `can`, `canForRecord`, `scopeFor`, department, self,
   owner, assignment and add-on evaluation.

`roles.js` becomes a compatibility facade while navigation and feature actions
move incrementally to the engine. UI components must not introduce new role
arrays or direct role comparisons for authorization.

Supabase helpers and policies must be validated against the same catalogue and
matrix, but generated SQL is reviewed and committed as a migration rather than
being generated dynamically at runtime.

## Required verification before production Supabase rollout

- Assert that every system role and capability ID is unique and immutable.
- Assert that every matrix row references catalogue IDs and valid scopes.
- Assert that no custom role or add-on contains `SYSTEM_ONLY` capabilities.
- Assert that restricted capabilities use an allowed role family.
- Test grants and denials for every role × capability × scope combination.
- Include cross-tenant, cross-department, self/owner/assignment and finalized
  lifecycle denial tests.
- Verify that role preview cannot authorize a write.
- Audit role, grant, scope, add-on and assignment changes with actor, target,
  organization, before/after values, timestamp and reason where required.

## Demo data boundary

Demo is a data environment, not an authorization scope. Seeded patients,
employees, surveillance, laboratory, prevention, controls, quality, documents,
committees and activity data may be loaded only for the dedicated demo tenant.
Production organizations start empty unless data is explicitly imported or
created. Browser persistence is partitioned by environment and organization so a
demo session cannot populate or leak into a production organization. Shared
system catalogues may remain globally available, but must be clearly separated
from tenant records and organization overrides.

## Known legacy gaps to remove during migration

The current compatibility model grants all non-platform capabilities to Hospital
Admin and all capabilities to Platform Owner. Both shortcuts conflict with this
model and must be removed before production RLS is considered authoritative.
Existing generic record capabilities such as `DELETE_RECORDS`,
`COMPLETE_RECORDS` and `APPROVE_RECORDS` must be replaced by domain and lifecycle
specific capabilities rather than copied into the new catalogue unchanged.
