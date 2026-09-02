# Canonical authorization model

Status: **Accepted for capability-matrix implementation**  
Scope: frontend authorization, role preview, Supabase authorization and RLS

## Decisions

1. The product has 13 immutable organization system-role IDs: `hospital_admin`,
   `infection_control_lead`, `infection_control_member`, `department_manager`,
   `department_user`, `laboratory`, `doctor_reviewer`, `occupational_physician`,
   `hr_office`, `quality_manager`, `committee_secretariat`, and `pharmacy`, plus
   the platform identity `platform_owner`. `demo` is an isolated demonstration
   role/environment and is not a production authorization role.
2. `platform_owner` is a platform identity attribute, not an organization
   membership role. The Platform Owner has explicit full platform and hospital
   access across organizations. This is an intentional privileged bypass and
   must be enforced only from the authenticated `profiles.is_platform_owner`
   identity attribute; it must never be assignable as an organization role,
   custom role, add-on or preview role.
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
   A broad `MANAGE` capability does not imply them for organization roles.
   Platform Owner remains the explicit privileged exception.
7. Governed evidence is never physically deleted after finalization. Platform
   Owner authority does not bypass evidence-retention semantics: finalized
   evidence is voided, archived or superseded with reason and audit metadata
   rather than physically deleted.
8. Role preview is a read-only presentation simulation. Authorization for every
   server operation uses the actor's real identity and grants. Previewing
   Platform Owner never grants Platform Owner authority.

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
`SYSTEM_ONLY`. `MANAGE_USERS`, `MANAGE_ROLES` and `MANAGE_ORGANIZATION` are also
`SYSTEM_ONLY` for custom-role purposes: they may be held by the immutable
Hospital Admin system role where explicitly defined, but cannot be assigned
through the custom-role editor or add-ons.

Sensitive capabilities require both the capability and an allowed role family.
At minimum, Occupational Health, employee clinical surveillance, protected
patient content and security administration are sensitive domains. Platform
Owner is an explicit privileged exception and retains full access; all such
access must remain attributable in the audit trail.

## Scope invariants

- `PLATFORM` applies only to platform resources.
- Platform Owner may cross organization boundaries only through the explicit
  platform-owner identity check; ordinary `ORGANIZATION` scope never becomes a
  cross-tenant grant.
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

- Platform Owner has full platform and hospital access across all organizations,
  including protected domains and system/reference governance. Only this
  identity may mutate master/reference records designated as platform-protected.
- Hospital Admin is the broad hospital administrator: organization configuration,
  users/roles, workforce identity, laboratory and other non-sensitive hospital
  operations are available without role switching. Protected patient clinical
  content and Occupational Health remain excluded by default unless a separately
  governed future capability explicitly changes that boundary.
- IPC Lead is organization-wide inside IPC domains and has organization-wide
  visibility of the employee administrative registry needed for infection
  prevention workflows. IPC Member remains narrower; lead governance actions
  remain separate capabilities.
- Link Nurse remains department-scoped.
- Department Manager and Department User remain inside assigned departments.
- Laboratory is treated as a department for workforce visibility: laboratory
  users see employees belonging to their assigned laboratory department(s).
  Laboratory workflow capabilities remain independently scoped and must not be
  restricted merely because workforce visibility is department-scoped.
- Laboratory capabilities are split into sample entry, processing, result entry,
  validation, critical communication, AMR classification, reopen and finalization.
- Doctor Reviewer requires explicit assignment for protected clinical records
  unless a separately governed organization-wide clinical grant exists.
- Occupational Physician is organization-wide inside the sensitive Occupational
  Health domain and may view the employee administrative identity needed for
  that workflow.
- HR Office administers organization-wide non-medical employee data and never
  inherits employee clinical or Occupational Health access.
- Quality Manager is organization-wide inside Quality/governance domains and
  receives no implicit patient or Occupational Health access.
- Committee Secretariat requires assignment to each committee.
- Pharmacy is organization-wide only inside pharmacy and antimicrobial
  stewardship domains; unrelated indicator or clinical visibility must not be
  inferred from the pharmacy role.

## Source-of-truth implementation

The implementation is split into four dependency-free specification modules:

1. `scopeTypes.js` — scope and record-relationship constants and validation;
2. `capabilityCatalogue.js` — canonical capability metadata;
3. `systemRoleMatrix.js` — immutable system role × capability rows; and
4. `permissionEngine.js` — `can`, `canForRecord`, `scopeFor`, department, self,
   owner, assignment and add-on evaluation.

`roles.js` is a compatibility facade while navigation and feature actions move
incrementally to the engine. UI components must not introduce new role arrays or
direct role comparisons for authorization.

Supabase helpers and policies must be validated against the same catalogue and
matrix, but generated SQL is reviewed and committed as a migration rather than
being generated dynamically at runtime. UI hiding is never considered an
authorization control.

## Required verification before production Supabase rollout

- Assert that every system role and capability ID is unique and immutable.
- Assert that Platform Owner cannot be assigned through organization membership,
  custom roles, add-ons or role preview authorization.
- Assert that every matrix row references catalogue IDs and valid scopes.
- Assert that no custom role or add-on contains `SYSTEM_ONLY` capabilities.
- Assert that restricted capabilities use an allowed role family.
- Test grants and denials for every role × capability × scope combination.
- Include cross-tenant, cross-department, self/owner/assignment and finalized
  lifecycle denial tests.
- Verify that role preview cannot authorize a write.
- Verify workforce RLS separately from Occupational Health RLS.
- Verify Laboratory workforce visibility is department-scoped without
  accidentally department-scoping hospital laboratory workflow data.
- Audit role, grant, scope, add-on and assignment changes with actor, target,
  organization, before/after values, timestamp and reason where required.
- Audit privileged Platform Owner mutations and protected-data access with the
  real actor identity and organization context.

## Demo data boundary

Demo is a data environment, not an authorization scope. Seeded patients,
employees, surveillance, laboratory, prevention, controls, quality, documents,
committees and activity data may be loaded only for the dedicated demo tenant.
Production organizations start empty unless data is explicitly imported or
created. Browser persistence is partitioned by environment and organization so a
demo session cannot populate or leak into a production organization. Shared
system catalogues may remain globally available, but must be clearly separated
from tenant records and organization overrides.

## Remaining migration gaps

- Replace generic record capabilities such as `DELETE_RECORDS`,
  `COMPLETE_RECORDS` and `APPROVE_RECORDS` with domain- and lifecycle-specific
  capabilities where governed evidence requires a narrower action.
- Complete capability-by-capability Supabase RLS alignment; a role-level scope is
  not sufficient for domains such as Laboratory where workforce visibility and
  laboratory workflow visibility intentionally differ.
- Keep protected system/reference master data immutable to organization users;
  only Platform Owner may mutate records explicitly designated as
  platform-protected.
