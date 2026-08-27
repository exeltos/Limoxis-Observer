# Clinical Surveillance Domain — v0.5.1

## Lifecycle model

The surveillance episode is **not a linear wizard**.

Patient → Surveillance episode → Initial/ongoing assessment → Active surveillance workspace → Outcome / authorized closure.

During active surveillance, these domains may evolve independently and in parallel:

- Clinical assessment and HAI classification
- Samples, microbiology and AST/AMR evidence
- Antimicrobial therapy / stewardship
- Isolation and transmission-based precautions
- Devices and risk factors
- Reassessments
- Timeline / audit evidence

MDR/XDR/PDR is not a workflow step. It is a classification derived from validated microbiology/susceptibility evidence and may change when new results arrive.

Isolation may start before a culture result. Therapy may start empirically before AST. Multiple samples, reassessments and isolation episodes may occur within one surveillance episode.

## Canonical ownership

| Data | Canonical owner | Surveillance behaviour |
| --- | --- | --- |
| Patient identity/admission | Patient Registry | Referenced |
| Clinical assessment + HAI classification | Infection Control / authorized clinical reviewer | Native surveillance evidence |
| Sample + microbiology + AST | Laboratory | Read/reference only from Surveillance |
| MDR/XDR/PDR classification | Validated microbiology/AMR logic | Derived/displayed; never a required step |
| Antimicrobial therapy | Pharmacy / stewardship | Read/reference only from Surveillance |
| Isolation / precautions | Infection Control | Native IPC workflow |
| Devices / risk factors | Clinical surveillance | Time-bound evidence |
| Reassessment | Infection Control | Repeatable follow-up evidence |
| Outcome | Authorized clinical reviewer | Episode outcome; closure remains separately authorized |
