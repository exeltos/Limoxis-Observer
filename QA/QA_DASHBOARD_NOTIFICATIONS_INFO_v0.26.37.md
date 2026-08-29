# v0.26.37 — Dashboard, Notifications, Announcements, Info, Undo foundation

## Scope
- Role-aware Dashboard keeps the role workspace and adds actionable operational items.
- Automatic birthday greeting from active employee `birthDate`.
- One login briefing per browser session/user with pending items and announcements.
- Functional bell with unread badge, notification popover, read/unread and mark-all-read.
- Announcement management for authorized Hospital Admin / Infection Control Lead / Platform Owner.
- Announcement targeting: hospital, role, department, individual user.
- Announcement priority and acknowledgement flag.
- Full-width product Info/About route.
- Undo toast infrastructure (`notifyUndo`) and first integration on announcement deletion.

## Governance
- Notification visibility is filtered by role/scope/audience.
- Production persistence and delivery should be backed by Supabase/RLS in the backend phase.
- Governed clinical records must continue to use void/archive/correction/supersede rather than generic physical delete.
- Real product screenshots were not embedded because the supplied Netlify `/login` URL returned 404 during implementation; no mock screenshot was misrepresented as production imagery.

## Regression note
Legacy v0.26.34/v0.26.30 string-exact checks are not used as blockers against the user-reviewed v0.26.36 baseline because that baseline already changed localized confirmation text. Equivalent edit/delete and confirmation wiring remains present.
