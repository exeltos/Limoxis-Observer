# Observer UI consolidation audit — v0.25.17

## Scope reviewed
Dashboard/application shell, Surveillance, Laboratory, Prevention, Quality, Committees, Patients, Employees, Occupational Health, Controls, Indicators, Management Center and shared design-system primitives.

## Cross-application corrections
- Canonical Print/Export utility pattern enforced globally: Printer + Download icons, no visible Print/Export words in action buttons.
- Added shared `PrintExportActions` for record headers.
- Added functional generic JSON record export for record pages and wired previously inert record export buttons. Registry exports for Patients, Employees, Occupational Health, Surveillance and Indicators now perform real downloads instead of only showing a notification.
- Added shared `TimeField`.
- Removed direct native date/time controls from feature UI; dates use `ManualDateField`, times use `TimeField`.
- Existing feature dialogs/forms now inherit a common Observer visual contract for shell, fields, focus states, footer buttons and close controls.
- Committee forms remain on the Observer design language; legacy Limoxis styling is not used.
- Product, clinical and laboratory i18n audits were brought back to zero hard-coded Greek strings in their audited UI files.

## Automated verification completed
- Clinical i18n audit: PASS
- Laboratory i18n audit: PASS
- Product i18n audit: PASS
- Product permissions audit: PASS (22 assertions)
- Navigation smoke: PASS (18/18)
- React hooks smoke: PASS (119 source files)
- Observer UI contract audit: PASS
- TypeScript parser JS/JSX syntax pass: PASS (119 files)

## Build limitation in this environment
A Vite production bundle could not be executed because the available sandbox dependency directories were only partially populated (the Vite package directory contained no executable/package files). No network dependency installation was used. This is recorded as an environment limitation, not reported as a successful production build.
