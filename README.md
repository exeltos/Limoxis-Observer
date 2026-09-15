# Limoxis Observer

Role-aware infection-prevention & hospital quality/governance platform: patient and employee surveillance (HAI/AMR), laboratory workflow, environmental sampling, prevention bundles (hand hygiene, antiseptic consumption, waste), occupational health, quality (incidents/audits/CAPA), committees, controlled documents, training & competence, and platform administration — built on React + Supabase.

For the full version-by-version history, see [`CHANGELOG.md`](./CHANGELOG.md).

## Stack

- React 18 + React Router 7, Vite 6
- Supabase (Postgres + Auth + Storage), `@supabase/supabase-js`
- Vitest + Testing Library
- ESLint (flat config)

## Getting started

```bash
npm ci
cp .env.example .env   # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm test` | Run the Vitest suite |
| `npm run lint` | ESLint over `src` and `tests` |
| `npm run check` | Full local pipeline: all `audit:*` checks + lint + test + build |

The `audit:*` scripts (see `tools/`) are project-specific regression guardrails — i18n parity (EL/EN), permission/role consistency, UI pattern consistency, navigation smoke tests, React hooks smoke tests, and frontend/production parity. `npm run check` mirrors what CI (`.github/workflows/ci.yml`) runs.

## Architecture

- `src/app` — router, shell, top-level navigation.
- `src/core/auth`, `src/core/tenant`, `src/core/permissions` — session, active organization/membership, and role→capability authorization.
- `src/core/supabase` — the only module that talks to the Supabase client directly.
- `src/design-system` — shared UI primitives (the "Observer" UI contract).
- `src/features/*` — isolated business domains (patients, surveillance, laboratory, prevention, employees, occupational-health, quality, committees, documents, training, controls, platform, ...).

**Security boundary**: UI-level permission checks are a usability layer only. Postgres Row-Level Security (RLS) on Supabase is the authoritative isolation boundary — every table carries `organization_id` and explicit RLS policies.

**Demo boundary**: demo/sample data is created client-side only when a user explicitly opts into Demo mode; production code paths never fall back to demo data silently.

See `docs/` for deeper domain references: `ARCHITECTURE.md`, `AUTHORIZATION_MODEL.md`, `DATA_MODEL.md`, `CLINICAL_DOMAIN.md`, `LABORATORY_DOMAIN.md`, `PREVENTION_DOMAIN.md`, `OBSERVER_UI_CONTRACT.md`, `GOVERNANCE_TRACEABILITY.md`.

## Database

Schema and RLS policies live in `supabase/migrations/`. See `docs/SUPABASE_CLEANUP_RUNBOOK.md` for maintenance procedures.

## Deployment

Static build deployed via Netlify (`netlify.toml`); `npm run build` outputs to `dist/`.
