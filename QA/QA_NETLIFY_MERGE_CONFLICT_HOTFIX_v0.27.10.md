# QA — Netlify merge conflict hotfix v0.27.10

- Removed/verified absence of Git merge conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`) across the source tree.
- Verified `src/core/tenant/TenantContext.jsx` contains the intended Platform Owner imports and no unresolved merge conflict.
- No functional change to Platform Owner Full Control behavior from v0.27.9.
- Version bumped to 0.27.10 / build 2026-08-30.99 for deployment traceability.
