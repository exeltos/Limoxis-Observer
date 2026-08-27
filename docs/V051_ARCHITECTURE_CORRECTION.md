# v0.5.1 Architecture correction

This release intentionally removes the sequential `Assessment → Samples → MDR/XDR → Therapy → Isolation → Reassessment → Outcome` mental model.

The UI and domain model now treat surveillance as an episode containing parallel, time-based clinical domains. This prevents the software from forcing a sequence that may be clinically incorrect.

HAI classification is explicit and stores the definition set, case status, criteria result and rationale. Device/risk-factor evidence is represented separately. AMR classification remains linked to validated microbiology evidence rather than being a mandatory workflow stage.
