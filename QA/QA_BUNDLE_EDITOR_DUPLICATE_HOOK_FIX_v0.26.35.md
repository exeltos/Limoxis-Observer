# v0.26.35 — Bundle editor duplicate hook fix

- Removed duplicated `const {notify,confirm}=useFeedback()` declaration from `BundleEditor`.
- Preserved bundle edit/delete and hospital override behavior from v0.26.34.
- Added a focused smoke check to prevent duplicate hook declarations from returning.
