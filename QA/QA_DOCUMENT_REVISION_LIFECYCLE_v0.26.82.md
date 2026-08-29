# v0.26.82 — Controlled document revision lifecycle

## Core rule
Published controlled documents are immutable in place.

## New revision flow
A published document now offers **New revision** instead of ordinary Edit.
Creating a revision:
- leaves the published source unchanged
- creates a new draft document
- increments the minor version
- stores `revisionOfId` and `supersedesId`
- stores actor name/ID and timestamps
- records revision creation in history
- links the source via `supersededById`
- navigates directly to the new draft for editing

## Publication of a revision
Publishing the new draft:
- publishes the revision with `publishedById`
- automatically archives the superseded published version
- records archive actor/time
- records a supersede history event
- keeps both versions as separate records/evidence

## Attachments
Published and archived documents are read-only for attachments. Attachments can be changed only while the version is Draft.

## Verification
- Document revision lifecycle: 8/8
- Governance classification: 6/6
- Governed lifecycle: 13/13
- Clinical/Lab/Product i18n
- Product permissions: 22
- Navigation: 18/18
- React hooks: 137
- Observer UI
- English parity: 1346/1346

Full dependency-backed lint/test/Vite build was not run in this packaging pass.
