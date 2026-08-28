# Controls temporary draft + feedback/UI — v0.22.0

- Temporary execution save is now a visible workflow state, not a hidden localStorage detail.
- Saving temporarily closes the execution card and returns the user to the registry.
- Registry shows a `Προσωρινή` badge for the matching control/department.
- The quick action remains enabled for a temporary draft, even before the next due time, and reopens/restores the saved fields.
- Added `Προσωρινή` to Controls status filtering.
- Final execution removes the temporary draft.
- Central toast rendering is environment-aware: success notifications are green in local/demo source mode and blue when Supabase configuration is active.
- Existing platform actions already using the shared FeedbackContext inherit the same mode-aware notification treatment.
- Controls create/temporary-save/final-save/edit/delete/cancel workflows emit explicit feedback.
- Department search field was corrected to a single clean field without an inner oversized browser-style input.
- Checkboxes in cards/editors were normalized to compact 14px controls, including the execution confirmation checkbox.
