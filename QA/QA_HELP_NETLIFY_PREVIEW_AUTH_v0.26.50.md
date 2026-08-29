# v0.26.50 — Netlify Help preview rendering fix

The Help Center preview was opening protected routes inside a fresh iframe app instance. The parent login state is not the same as an in-memory React auth state inside that iframe, so the expected module could remain blank/not render.

Fix:
- `helpPreview=1` activates only inside an iframe.
- The iframe starts an isolated DEMO session and never reuses/exposes the parent's real clinical session.
- `helpRole=<role>` mirrors the parent Help Center role.
- Login briefing/birthday/help overlays are suppressed inside the embedded preview.
- The preview remains read-only because pointer events are disabled by Help Center CSS.
