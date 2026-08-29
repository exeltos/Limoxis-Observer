# v0.26.54 — Help preview zoom fit

Fixes the enlarged Netlify preview so the whole 1440×900 application viewport is visible inside the lightbox.

- Large preview keeps the full page proportions.
- Uses a scaled 1440×900 iframe rather than cropping the live page.
- Responsive scale reduces automatically on smaller screens and shorter viewports.
- Existing read-only behavior remains unchanged.
