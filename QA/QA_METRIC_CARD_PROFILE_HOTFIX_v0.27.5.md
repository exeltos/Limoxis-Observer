# v0.27.5 — Metric Card / My Profile Hotfix

- Fixed the v0.27.4 CSS serialization defect: the canonical metric-card stylesheet had been appended with literal `\\n` characters, so the browser did not parse the rules. This is why Employees rendered icons/numbers as unboxed text while Laboratory still showed legacy cards.
- Canonical MetricCard CSS is now valid CSS and therefore controls geometry, icon tile, icon size, number typography, label typography, border, radius and spacing.
- Metric grids are adaptive equal-width grids (`auto-fit/minmax`) so 4-card and 5-card modules use the same component without forcing the same column count.
- `/my-profile` now resolves the signed-in employee by explicit membership/profile employee id, then email; demo mode explicitly maps to EMP-001.
- Removed the unsafe assumption that self profile is always `employeeRows[0]`.
- Added a safe empty state if a real authenticated account has no employee record mapping instead of crashing the route.
