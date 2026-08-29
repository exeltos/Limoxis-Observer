# v0.26.52 — Help Center slide-in visibility hotfix

Root cause:
`v0.26.51` used `inset:auto 0 0 244px` on the fixed Help backdrop.
That removed the top anchor and could collapse the backdrop, so the Help Center did not appear.

Fix:
- Desktop Help backdrop: `inset: 0 0 0 244px`
- Manual Center is pinned with `inset: 0`
- Explicit full-height / visible state
- Mobile/tablet fallback continues to use the full viewport

No Help content, role filtering, Netlify live preview or briefing behavior was changed.
