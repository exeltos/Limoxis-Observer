# Limoxis Observer Architecture — v0.2.0

## Principles
The new codebase is organized around domain boundaries, not legacy screens. Shared behavior is centralized before clinical modules are implemented.

## Runtime layers
- `src/app`: router, shell and product navigation.
- `src/core/auth`: authentication/session orchestration.
- `src/core/tenant`: active organization and memberships.
- `src/core/permissions`: role-to-capability authorization.
- `src/core/supabase`: external data client only.
- `src/design-system`: reusable UI primitives.
- `src/features`: isolated business domains.

## Security boundary
UI permissions are usability controls only. Database RLS is the authoritative isolation layer. Every future clinical table must carry `organization_id` and receive explicit RLS policies before being considered complete.

## Demo boundary
Demo state is created in the client only when the user explicitly selects Demo. Production repositories never fall back to demo records silently.
