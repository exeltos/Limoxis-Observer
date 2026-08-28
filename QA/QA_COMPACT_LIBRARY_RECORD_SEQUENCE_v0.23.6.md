# Compact Library + Previous/Next Record Navigation — v0.23.6

## Bundle Library
- Replaced card grid with compact sticky table/list.
- Columns: Bundle, version, status, element count, guideline/source, scope, actions.
- Row click opens the bundle definition.
- Draft/Publish/Retire governance remains unchanged.

## Record navigation pattern
- `useRegistryMemory.openRecord` now stores the current filtered/ordered record id sequence.
- New reusable `useRecordSequenceNavigation` helper.
- `EntityRecordShell` supports generic Previous / Next navigation with position counter.
- Prevention record pages use the generic sequence navigator.
- Navigation stays inside the detail view and preserves the original registry return state.
- The sequence represents the filtered list the user opened the record from, not the unfiltered dataset.

## Platform rule
Apply the same `EntityRecordShell.recordNavigation` pattern progressively to every registry-backed record page.
