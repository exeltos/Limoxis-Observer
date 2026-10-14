# TypeScript migration

Limoxis Observer moves from JavaScript to TypeScript **one module at a time**. Each module is its own pull request, merged only after it passes every check below and has been tried in the demo. The conversion changes types only: what the application does, what users see, and the Supabase database stay the same.

## Conventions

- `.ts` for modules, `.tsx` for files that contain JSX. Converted files sit beside unconverted `.js`/`.jsx` files.
- Imports inside `src` stay extensionless (`from './roles'`), as today; Vite resolves `.js`, `.jsx`, `.ts` and `.tsx` alike.
- A module that Node runs directly (the `tools/*.mjs` audits import some `src` modules) uses explicit `.ts` extensions in its own imports, and the audit imports it as `.ts`. Node 22 runs `.ts` files natively by stripping the types; `allowImportingTsExtensions` lets the type checker accept those paths.
- Only type syntax that can be erased (`erasableSyntaxOnly`): no `enum`, `namespace` or constructor parameter properties. Use `as const` objects and union types instead.
- Every `.ts`/`.tsx` file in `src` is checked by `npm run typecheck:strict` (`strict`, `noImplicitAny`) through `tsconfig.typescript.json`. There is no per-file opt-out. That project has `checkJs` off, so an unconverted `.js` file that a `.ts` file imports is read for its exports but not checked: a conversion never fails because of code it did not touch. The JSDoc-typed JavaScript (`src/core/permissions`) keeps its own strict project, `tsconfig.strict.json`.
- Database rows: `Database['public']['Tables']['<table>']['Row']` from `src/core/supabase/database.types.ts`. Regenerate the file after a schema migration (`supabase gen types typescript`); never edit it by hand.
- New code is written in TypeScript from the start.

## Rules for each module

1. **Types only.** No change in behaviour, markup, CSS class names, text or data access. A real bug found by the type checker is fixed in a separate pull request.
2. **One module per pull request**, so a problem is reverted without touching the others.
3. **Tests move with the code.** Tests and audits that read a source file by path (`fs.readFileSync('src/…/X.jsx')`) or assert on its exact text are updated in the same pull request. No test is deleted, skipped or weakened; the test count is the same before and after.

## Checks before merging a module

- [ ] `npm run check` passes (all audits, strict type check, lint, tests, build).
- [ ] Test count unchanged against the baseline below (or higher, never lower).
- [ ] No `any`, `@ts-ignore` or `@ts-expect-error` added without a comment saying why.
- [ ] CI visual comparison against `main`: no differences on any screen, width or language.
- [ ] The module's screens tried in Demo mode by the reviewer.
- [ ] Diff reviewed: only type annotations, renames and the matching test/audit path updates.

## Baseline (2026-10-14, before any module was converted)

| Check | Result |
| --- | --- |
| `npm run check` | passes, about 2 minutes |
| Test files | 349 |
| Tests | 1628 |

## Order

| Phase | Scope | Size (lines of JS) |
| --- | --- | --- |
| 0. Setup | Tooling, generated database types, this document | — |
| 1. Pilot | `src/core/permissions` (already JSDoc-typed; imported by audits) | ~400 |
| 2. Core | rest of `src/core`, `src/design-system`, `src/app` | ~6,500 |
| 3. Small modules | patients, pharmacy, occupational-health, clinical-scales, reporting, indicators, lira, analysis, dashboard, calendar, workspaces, auth, account, legal, about, recycle-bin | ~9,000 |
| 4. Medium modules | documents, training, demo, controls, quality, management, laboratory | ~14,000 |
| 5. Large modules | committees, platform, employees, prevention | ~18,000 |
| 6. Surveillance | `src/features/surveillance`, in 3–4 parts | ~12,400 |
| 7. Finish | `strict` for all of `src`, no new `.js`/`.jsx` files, documentation | — |

## Watch list

- **Audits that walk `src` by extension** (`check-dead-selectors`, `check-react-hooks-smoke`, `check-observer-ui-patterns`, `check-frontend-parity`, `report-english-ui-risk`) include `.ts`/`.tsx` since phase 0. `check-dead-selectors` matters most: if it could not see `.tsx` files, `npm run css:prune` would delete styles those files use.
- **Audits that name files** (`check-clinical-i18n`, `check-product-i18n`, `check-lab-i18n`, `check-navigation-smoke`, `check-observer-ui-patterns`, `check-dead-css` via `src/main.jsx`) fail loudly when a listed file is renamed; update the path in the same pull request.
- **Tests that read source text**: 111 test and audit files read source files by path (206 distinct files).
- **Parallel work**: convert a module when no other open pull request is changing it.
