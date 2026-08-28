# Platform Audit — Wave 2: UI/Governance Consistency — v0.24.0

## Fixed in this wave

### Canonical category tabs
Quality and Surveillance no longer use a separate pill/module-tab design.
They now use the same `.tabs` + `.tab` interaction language as the rest of Limoxis Observer:
- same height
- same padding
- same active background
- same typography
- same count badge treatment
- same full-width white tab surface
- locked surveillance categories retain the same tab shape.

This creates one reusable category-tab rule instead of per-module variants.

### Shared top-level actions
Laboratory and Controls now use the central `RecordActions` component instead of local/custom top action markup.
Across operational registry pages, Create / Print / Export now come from one shared action component:
- Patients
- Employees
- Surveillance
- Laboratory
- Prevention
- Controls
- Quality
- Indicators
- Occupational Health

Laboratory also gains real Print and filtered CSV Export behavior through the shared pattern.

## Audit findings still open

### HIGH — placeholder modules
The following routed modules are still functional placeholders rather than production modules:
- AI / LIRA
- Training
- Committees
- Documents
- Records / Registries

These must not be considered production-complete. They require workflow/data-model/permission/audit-trail implementation, not cosmetic work.

### HIGH — backend governance not yet enforceable
Current frontend governance patterns are not a substitute for Supabase RLS/database constraints.
The production phase still requires:
- organization and department scope enforcement in RLS
- immutable audit events
- published/finalized evidence guards
- correction/reopen metadata
- actor identity from auth, never UI text
- template/version snapshot persistence

### MEDIUM — legacy CSS accumulation
The stylesheet still contains historical module-specific rules that are now overridden by newer canonical rules.
They do not currently break the audited screens, but should be consolidated later into design-system tokens/components to reduce regression risk.

## Audit direction
Next wave should focus on clinical/data lifecycle:
1. finalized/closed record mutation paths
2. correction/reopen reason requirements
3. actor/time/source provenance
4. sensitive employee-health access
5. master-data/library source-of-truth usage
6. Supabase/RLS mapping table by table
