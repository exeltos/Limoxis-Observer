# v0.26.49 — Help Center live Netlify visuals

- Removed static/manual screenshot assets from the Help Center.
- The right preview now loads the actual published Limoxis route from `https://limoxis-observer.netlify.app`.
- Clicking the thumbnail opens a larger read-only live preview.
- A `helpPreview=1` query flag is added to preview URLs for future preview-specific UI handling.
- When already running on the Netlify production hostname, the current origin is reused.
- GitHub Actions CI from v0.26.48 is preserved.
