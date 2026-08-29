# v0.26.47 — CI gate fixes

- Fixed the three hard-coded Greek strings reported by GitHub Product i18n audit.
- Help Center label now uses `t(helpInformationCenter)`.
- Management Announcements tab now uses `t(announcements)`.
- Undo toast action now uses `t(undo)`.
- Added EL/EN translations for all three.
- Replaced native announcement date/time inputs with shared `ManualDateField` and `TimeField`, preventing the next Observer UI audit failure and restoring shared field design.
- Product i18n, Observer UI, React hooks, navigation and permissions focused audits pass locally.
