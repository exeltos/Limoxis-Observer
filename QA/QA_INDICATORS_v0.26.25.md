# v0.26.25 — Indicators
Replaced static demo KPI cards with a governed indicator registry calculated from current Limoxis domain datasets.
Current automatic sources: Surveillance, WHO hand hygiene, Bundles, Antiseptic consumption, Training, Employees/vaccination records, Quality.
Each indicator exposes value, unit, numerator, denominator, evidence, source, definition version, target and status.
Detail opens in a shared dialog and can navigate to the primary source module.
Targets are intentionally definition metadata for now; management editing belongs in the upcoming Management Center pass.
Indicators requiring unavailable source data (e.g. DDD, validated BSI incidence, PPS) are not falsely calculated in this version.
