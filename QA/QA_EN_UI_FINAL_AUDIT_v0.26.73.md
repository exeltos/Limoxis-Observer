# v0.26.73 — Final EL/EN UI audit pass

Built from the user-reviewed v0.26.71 baseline through v0.26.72.

## Final residual fixes
- Shared EntityRecordShell previous/next record navigation accessibility text follows EL/EN.
- Shared ObserverDialog close control and DialogActions defaults follow EL/EN.
- ExpandableTextBlock expansion/view controls follow EL/EN.
- ManualDateField displays `dd/mm/yyyy` in EN and `ηη/μμ/εεεε` in EL.
- Pharmacy placeholder workspace follows EL/EN.
- Employee record access-denied, committee approval prompt, actions and feedback follow EL/EN.
- Quality creation from a Control now creates both Greek and English title/description prefills, rather than injecting Greek text into the English edit surface.

## Scanner interpretation
`report-english-ui-risk.mjs` is intentionally conservative. It counts Greek-containing source lines, including:
- deliberate EL/EN ternaries,
- bilingual catalog data (`labelEl` / `labelEn`, `titleEl` / `titleEn`),
- compatibility values kept in Greek for stable persistence,
- historical/audit evidence strings.

Therefore its raw line count is not a count of untranslated English-mode UI. The count may increase when a formerly Greek-only literal becomes an explicit EL/EN branch.

## Verification
Passed:
- Clinical i18n audit
- Laboratory i18n audit
- Product i18n audit
- English parity: EL 1346 / EN 1346
- Help manual coverage
- Product permissions: 22 assertions
- Navigation smoke: 18/18
- React hooks smoke: 136 source files
- Observer UI patterns
- Help preview language: 5/5

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
