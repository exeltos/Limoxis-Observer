# Sidebar Information Architecture — v0.24.2

## Goal
Hospital Admin keeps full hospital functionality without turning the left navigation into a long flat list.

## Always visible primary navigation
The primary operational modules remain directly visible, including:
- Dashboard
- My Profile
- Surveillance
- Laboratory
- Prevention
- Controls
- Records
- Quality
- Patients
- Employees
- My Department when the role has it

`My Profile` intentionally stays visible.

## Collapsed "More" group
The following lower-frequency/specialized modules are grouped under one inline expandable sidebar item:
- Indicators
- Training
- Committees
- Documents
- Pharmacy
- Occupational Health
- AI / LIRA

This is an inline sidebar group, not a floating popup menu.

If the current route belongs to this group, "More" automatically renders expanded so location/context is never hidden.

## Management Center
Management remains a separate bottom navigation item because it represents platform/hospital administration rather than an operational specialty.

## Permissions
No capability was removed. This change affects information architecture only.
Hospital Admin retains the full organization-level access established in v0.24.1.
Other roles only see the children they actually have permission to access.
