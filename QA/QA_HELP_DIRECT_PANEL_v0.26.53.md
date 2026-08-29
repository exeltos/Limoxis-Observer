# v0.26.53 — Direct Help panel render

The Help Center no longer depends on the shared `.help-backdrop` overlay.

Reason:
legacy backdrop CSS had accumulated multiple conflicting `inset`, mobile and overlay rules across earlier iterations.

Implementation:
- Help renders as a direct fixed `aside.help-panel-shell`.
- Desktop bounds: top/right/bottom 0, left 244px (right edge of the main sidebar).
- Responsive fallback: full viewport below 1100px.
- Existing role-aware current-section opening, larger typography, live Netlify preview and image zoom remain unchanged.
