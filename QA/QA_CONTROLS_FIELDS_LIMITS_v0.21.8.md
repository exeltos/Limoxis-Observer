# Controls fields & limits — v0.21.8

- Medication/material structured form uses only: Material/Medication, Quantity, Expiry Date, Finding.
- Finding values: Expired, Near-expiry, Other. Selecting Other opens a clarification field.
- Printed form keeps the same four logical columns; Other clarification is merged into Finding.
- Temporary save renamed to "Save temporarily"; it stores the in-progress entry locally and restores it when the same control/department entry is reopened.
- Control execution/editor inputs and selects use consistent application styling instead of browser-default black controls.
- Numeric controls define unit/min/max acceptable range directly on the control definition.
- Out-of-range numeric entries are automatically treated as findings and can generate a linked report.
