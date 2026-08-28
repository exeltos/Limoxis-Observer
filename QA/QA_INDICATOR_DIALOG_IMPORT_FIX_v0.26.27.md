# v0.26.27 — Indicator dialog import fix
- Fixed incorrect `DialogActions` import. It is exported from `design-system/ObserverDialog.jsx`.
- Corrected Indicator dialogs to use the shared `ObserverDialog footer` pattern.
- New Indicator uses `DialogActions` with proper onCancel/onSave/disabled props.
- Indicator detail uses explicit Close / Open Source buttons in the dialog footer.
