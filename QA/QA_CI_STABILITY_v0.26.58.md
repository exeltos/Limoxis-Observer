# v0.26.58 — CI stability

Latest failure cause:
v0.26.57 added three hard-coded Greek strings in AppShell for logout confirmation. Product i18n correctly blocked the run.

Changes:
- Moved logout confirmation title/message/farewell to central EL/EN translations.
- AppShell uses `t(...)` for those strings.
- Updated actions/checkout and actions/setup-node from v4 to v5 so GitHub no longer warns about the deprecated Node.js 20 action runtime.
- The application itself still runs/tests on Node.js 22, matching package.json.
- Updated the v0.26.57 focused checker so it tests translated behavior rather than literal Greek text.
