# Prevention WHO + drill-down — v0.22.4

- All Prevention registry rows are clickable and open a dedicated record page.
- Added `/prevention/:recordType/:recordId`.
- Hand Hygiene creation now uses WHO observation sessions rather than aggregate counters.
- WHO session fields: date, department, observer from login, start/end time.
- Each opportunity records professional code, professional category, one of WHO 5 Moments, HR/HW/MISSED action, gloves and optional notes.
- Compliance derives from opportunities: (HR + HW) / opportunities.
- Record drill-down shows session metrics and the full list of individual WHO opportunities.
- Waste, antiseptic and bundle rows also open dedicated read-only record details.
