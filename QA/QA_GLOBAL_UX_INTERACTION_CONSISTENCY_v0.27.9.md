# v0.27.9 — Global UX & Interaction Consistency Pass · Batch 1

Implemented centrally rather than as visual mockups.

- Shared async-aware Button loading state and spinner.
- Dialog save actions use a diskette icon and spinner while awaiting async save.
- Canonical amber pencil styling for Edit/Correction; destructive actions remain red.
- Occupational Health rows are clickable; removed redundant Open Employee buttons.
- Clinical Surveillance sample rows are clickable and open the laboratory sample.
- Therapy records are clickable; removed redundant Open in Pharmacy button.
- Management horizontal menu no longer scrolls; tabs compress within the available width.
- Canonical section-help typography introduced and applied to Training participant guidance.
- Laboratory previous/next workflow navigation has distinct step-navigation treatment; Next is visually primary.
- Training participant toolbar preserves visibility of Add.

Existing shared AttachmentField remains the canonical attachment mechanism. A raw-file scan is included in the consistency checker so feature attachments do not silently fork into new upload patterns.
- Department Manager / Department User no longer receive both Dashboard and My Department in the sidebar; My Department is their primary workspace.
- Committee Role & legal framework / FEK is now editable under permission control, with actor/timestamp history instead of silent overwrite.
- Document History uses the canonical full-width FilterBar geometry.
