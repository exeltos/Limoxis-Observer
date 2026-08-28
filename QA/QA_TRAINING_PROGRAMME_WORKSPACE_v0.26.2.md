# QA — Training Programme Workspace v0.26.2

## Scope
- Shared compact summary cards aligned with Prevention Center.
- Prevention migrated from `prevention-kpi*` markup to central `module-summary-*` markup.
- Training programme record workspace.
- Participant invitations and attendance confirmation.
- Training materials.
- Learner-to-trainer/training feedback.
- Trainer-authored trainee assessment.
- Aggregate result indicators.

## Expected workflow
Programme → Participants → Bulk invitation/confirmation → Materials → Learner feedback → Trainee assessment → Results/competence.

## Governance notes
- Learner satisfaction is separate from competence assessment.
- A failed assessment is retained and flags retraining/reassessment rather than being silently overwritten.
- Demo email actions create queued records; they do not claim external delivery.
