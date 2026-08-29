# v0.26.69 — Controls EL/EN completion pass

- Control Editor scheduling interval label is bilingual.
- Category and owner suggestions now present English choices in EN mode while preserving compatibility with existing stored Greek values.
- Numeric unit placeholder is bilingual.
- Control execution fallback result label and legacy choice labels are rendered in English when appropriate without mutating historical stored values.
- Control frequency formatter now accepts language and renders daily/weekly/monthly/yearly/custom schedules in EL/EN.
- Controls registry, record and execution surfaces use the language-aware frequency formatter.
- Control Record delete confirmation is fully bilingual for single- and multi-department controls.
- Existing governed void/cancellation flow remains bilingual and preserves the original entry in audit history.
