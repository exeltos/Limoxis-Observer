# Laboratory Edit/Workflow + Sidebar Collapse — v0.24.3

## Laboratory
- General Edit/Correction is always visible to Hospital Admin / users with laboratory management or reopen capability.
- Completed or validated records no longer hide the correction action just because `finalizedAt` is absent.
- If the record is active, Edit opens the editable workflow directly.
- If completed/validated/finalized, Edit opens governed correction and requires a reason.
- Added common Previous step / Next step navigation at the bottom of laboratory record workflows.
- Navigation only moves to steps already accessible according to workflow state.
- Implemented for:
  - standard patient laboratory records
  - employee-screening laboratory records
  - environmental laboratory records
- Existing record-to-record previous/next navigation remains separate in the record header.

## Sidebar
- The More group collapses when the user selects another primary module or Management Center.
- If the user opens a child inside More, the group remains expanded because that is the active navigation context.
- My Profile and primary operational modules remain directly visible.

## UX distinction
Two navigation mechanisms are intentionally separate:
1. Header arrows = previous/next RECORD in the filtered registry.
2. Bottom workflow controls = previous/next STEP inside the current laboratory record.
