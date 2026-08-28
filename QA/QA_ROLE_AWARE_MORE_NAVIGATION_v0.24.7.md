# Role-aware More navigation — v0.24.7

## Decision
`Περισσότερα / More` is NOT a platform-wide navigation pattern.

It is rendered only for:
- Hospital Admin
- Infection Control Lead

These two roles have sufficiently broad operational access that a compact secondary group is useful.

## All other roles
Laboratory, Department Manager/User, HR, Pharmacy, Occupational Physician, Doctor Reviewer,
Quality Manager, Committee Secretariat, Infection Control Member, etc. do not receive a More
accordion.

Their sidebar is already permission-filtered and displays their allowed modules directly.

## Important
This changes navigation presentation only. It does not add/remove capabilities.

The exact contents of More for Hospital Admin and Infection Control Lead remain intentionally
subject to the later frequency-based information-architecture pass.
