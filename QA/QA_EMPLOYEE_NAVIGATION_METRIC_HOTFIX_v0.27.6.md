# v0.27.6 — Employee Navigation + Metric Card Hotfix

## Fixed
- `My Profile` no longer changes hook order while tenant/demo identity is resolving.
- All hooks in `EmployeeRecordPage` execute before empty/not-linked returns.
- Employee registry rows use one explicit `openEmployee(row)` navigation path.
- Employee detail route remains `/employees/:employeeId`.
- Self profile route remains `/my-profile`.

## Metric cards
Canonical metric cards are now slightly shorter:
- height: 84px
- icon tile: 34px
- icon: 17px
- value: 19px
- label: 10px
- identical inherited font family across all cards

## Verification
- employee/profile navigation regression: 14/14
- React hooks smoke: 141 source files
- navigation smoke: 18/18
- Observer UI audit: OK
- English parity: 1346/1346
- card/dialog geometry: 15/15

Full dependency-backed lint/build was not completed locally because dependencies are not fully installed in this extracted release workspace. CI remains the final lint/test/build gate.
