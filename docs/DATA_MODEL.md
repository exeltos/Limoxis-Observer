# Data Model — v0.2.0

## Identity
`auth.users` is owned by Supabase Auth. `profiles` stores non-authentication user metadata.

## Tenancy
`organizations` is the tenant root. Optional `parent_id` supports a future hospital group containing multiple hospitals.

`organization_members` joins users to organizations and assigns exactly one application role per membership. A user may belong to multiple organizations and switch active membership in the app shell.

## Governance
`system_audit_log` is append-oriented and organization-aware. Clinical domains added from v0.3.0 onward must reference `organization_id` directly and never infer tenant ownership from client state alone.
