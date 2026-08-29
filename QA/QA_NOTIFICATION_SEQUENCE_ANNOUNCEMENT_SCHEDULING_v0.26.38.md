# v0.26.38 — Greeting sequence, briefing recovery, scheduling and owner test tools

- Birthday greeting is a separate first popup. Closing it opens the operational briefing.
- Birthday greeting is not mixed into Dashboard/briefing content.
- Briefing and birthday greeting can always be reopened from the bell menu.
- Bell lists unread items only: opening an item marks it read, removes it from the visible queue and decrements the unread badge.
- Owner/demo-only test center can replay greeting/briefing and inject a test bell notification.
- Announcements support multiple roles, departments, or users.
- Announcement delivery supports start/end date and time; active visibility respects that window.
- Recipient selector, schedule fields and editor sections use the shared form visual language.
- Sidebar exposes an explicit `Πληροφορίες Limoxis` link and the version stamp opens the full Info page.
- Netlify SPA routing added via `public/_redirects` and `netlify.toml`, so direct `/login` routes resolve to `index.html` after redeploy.
