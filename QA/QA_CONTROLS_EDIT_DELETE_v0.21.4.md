# Controls edit/delete — v0.21.4

- Edit and Delete are visible inside a control only to the role that owns the definition.
- Infection Control Lead may edit/delete central Infection Control controls; deletion removes the definition from all assigned departments.
- Department Manager may edit/delete only department-created controls belonging to their own department.
- Department Users cannot see definition edit/delete actions.
- Central controls remain read-only to departments.
- Delete uses explicit confirmation and returns to the controls registry.
