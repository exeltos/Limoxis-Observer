# Surveillance Counts + KPI Alignment — v0.23.9

## Visual consistency
- Surveillance and Quality summary metrics now use the same operational KPI card scale:
  - 112px minimum height
  - independent white cards
  - shared border/radius/icon treatment
  - 4-column layout / 2-column responsive fallback
- Removed the compressed 64px segmented-strip appearance.

## Employee surveillance refresh
- Employee surveillance creation now emits a central `limoxis:employee-surveillance-updated` event.
- Bulk employee surveillance creation emits the same event with batch metadata.
- Surveillance page listens to that event and refreshes counts/registries.
- Employee and bulk tab counts are taken from the current module-level collections after every refresh.

## Demo/permission coherence
- Demo hospital mode can exercise Employee and Bulk Employee Surveillance end-to-end.
- Production roles still follow the sensitive employee-health policy.
- This fixes the previous inconsistent state where Demo/Hospital Admin could create employee surveillance but then see the category locked.

## Expected checks
1. Create one Employee Surveillance → Employees count increments immediately and the record appears.
2. Create one Bulk Surveillance → Bulk count increments immediately; generated employee surveillance records also appear under Employees.
3. Switching tabs does not require page reload.
4. Quality and Surveillance KPI cards are visually aligned.
