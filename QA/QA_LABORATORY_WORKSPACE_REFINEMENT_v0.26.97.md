# v0.26.97 — Product refinement / Laboratory workspace

## Goal
Refine the daily laboratory registry while preserving the surveillance-laboratory traceability model.

## Changes
- Stable summary → filters → independently scrolling registry layout.
- Filters remain fixed above results.
- Laboratory table receives explicit minimum geometry for seven operational columns.
- Row hover, keyboard focus and contextual-return highlighting normalized.
- Result cell now has a controlled inline hierarchy for result, AMR and critical flags.
- Surveillance linkage rendered as a compact traceability chip.
- KPI strip tightened to reduce vertical cost while preserving five operational signals.
- Critical, AMR and linked-case visual signals use the central semantic visual language.

## Preserved
No laboratory workflow, validation/finalization lifecycle, surveillance linkage, permission, audit metadata or creation behavior changed.

## Verification
Laboratory workspace 9/9; Surveillance 8/8; Visual consistency 10/10; page hierarchy 7/7; tables 7/7; detail 7/7; actions 6/6; registries 11 + contract; 0 native date/time controls; governance checks green; permissions 22; navigation 18/18; hooks 137; Observer UI OK; EL/EN 1346/1346.

Full dependency-backed npm check was not run because dependencies are not included in the release archive.
