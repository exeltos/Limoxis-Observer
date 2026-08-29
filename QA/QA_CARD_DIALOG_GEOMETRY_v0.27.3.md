# v0.27.3 — Canonical Card / Dialog Geometry

## Problem corrected
The application still contained many independent card/modal width, height, radius and padding rules. A shared visual language existed only partially.

## Canonical contract
Added `src/design-system/Card.jsx`.

Canonical card tokens:
- radius 12px
- common border/background
- compact / standard / comfortable padding

ObserverDialog now accepts only:
- compact: 520px
- standard: 760px
- wide: 1040px
- workspace: 1280px

All ObserverDialog shells use the same header/body/footer geometry.

## Legacy modal consolidation
Existing feature modal cards are centrally normalized at the end of global.css. Old feature rules can still define internal content layout but cannot determine shell width/height/radius.

Standard 760px:
patient, surveillance, prevention, waste, antiseptic, laboratory, AST, communication, certificate, correction and normal entry/editor cards.

Wide 1040px:
control editor and wide control execution workspace.

Arbitrary forced modal heights are removed by the final shell contract.

## In-page cards
Common record/clinical panels share border, radius and padding family.

## KPI cards
Existing KPI implementations are forced to the same physical geometry:
- 96px exact height
- 14x15 padding
- 12px radius
- same border/background
- same grid gap

This specifically prevents Patients/Laboratory/Prevention/Controls from rendering different physical card heights because of legacy CSS.

## Guard
`tools/check-card-dialog-geometry.mjs` verifies the size tokens, ObserverDialog whitelist, legacy modal normalization and KPI geometry.
