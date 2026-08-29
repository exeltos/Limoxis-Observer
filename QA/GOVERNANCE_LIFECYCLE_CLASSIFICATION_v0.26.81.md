# Governance lifecycle classification — v0.26.81

The application must not force one lifecycle onto semantically different records.

## Governed correction / void contract
Use the shared `governedLifecycle` contract for evidence-like operational records where finalized data must become read-only and corrections must preserve the original evidence:
- Prevention records
- Quality findings/records
- Laboratory records

## Domain-specific immutable/history lifecycle
Keep domain-specific semantics when the workflow is not a generic finalized record:
- Controls: completed execution remains in history; edit is audited; cancellation marks the execution voided with reason/actor, never physical delete.
- Documents: Draft → Published → Archived. Publication and archival are document-control states, not generic correction/reopen. Published versions should later use a formal revision/supersede workflow rather than unlock-in-place.
- Committees: meeting/minutes/approval workflow has approval and finalization semantics; changes after approval should follow minutes revision/approval rules rather than generic record correction.
- Training: attendance, assessment and certificate evidence has event-specific correction rules; do not unlock an entire training program just because one attendance record changes.
- Clinical surveillance: patient journey contains multiple state machines (therapy, isolation, outcome, follow-up). Apply governed correction to specific finalized evidence, not the whole journey object.

## Document traceability strengthened in v0.26.81
Published documents now retain `publishedById`.
Archived documents now retain `archivedAt`, `archivedBy`, `archivedById`.

This classification is deliberate: governance should improve traceability without adding unnecessary steps to routine workflows.
