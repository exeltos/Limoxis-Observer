# v0.26.21 — LIRA AI

- Replaced the placeholder LIRA page with a functional analysis workspace.
- LIRA synthesizes existing Limoxis demo-domain data from Surveillance, Laboratory, Prevention and Quality.
- Three shared tabs: Overview, Risk Signals, Ask LIRA.
- Risk signals are deterministic/rule-derived in local/demo mode and never presented as autonomous AI diagnosis.
- Signals carry severity, source domain, department, evidence and a direct link back to the primary workflow.
- Overview includes operational priorities, domain summaries and next-action prompts.
- Ask LIRA supports natural-language-like questions over the locally computed analysis with predefined useful prompts.
- Explicit clinical safety wording: decision support only; no diagnosis, treatment order or automatic record mutation.
- No external AI/network call is made in this version.
