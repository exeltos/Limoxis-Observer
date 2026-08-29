# v0.26.46 — Real screenshots + GitHub CI

## Help Center
- Kept the professional three-column manual structure.
- Removed the old schematic/fake preview renderer.
- Added real Limoxis Observer screenshots for Surveillance, Prevention, Quality, Controls, Committees and LIRA.
- Clicking the thumbnail opens a large lightbox.
- Sections not yet captured use a read-only live screen preview as a temporary fallback.
- Real screenshot assets live under `public/help/screens/` with a maintenance README.

## GitHub Actions
- Added `.github/workflows/ci.yml`.
- Runs on push/pull request to `main` and manual workflow dispatch.
- Node 22 + npm ci.
- Runs i18n audits, permissions, navigation, hooks, Observer UI audit, lint, tests and production build.
