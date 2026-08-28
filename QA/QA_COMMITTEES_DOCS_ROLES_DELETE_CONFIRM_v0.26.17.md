# v0.26.17 — Committees documents, roles & delete confirmation

## New Committee card
- Typography normalized to the common Limoxis form scale and inherited font.
- Committee role is no longer pre-filled only as “Μέλος”.
- Common role suggestions include: Πρόεδρος, Αντιπρόεδρος, Συντονιστής, Γραμματέας, Μέλος, Αναπληρωματικό μέλος, plus template-specific functions.
- Role remains editable/free text.

## Documents
- Committee Documents is now functional with the shared AttachmentField.
- Add/view/edit/delete behavior follows the common attachment component.
- Attachment changes update committee audit history.

## Delete confirmation audit
Direct destructive controls were audited.
- Committee draft member removal asks confirmation.
- Meeting topic removal asks confirmation.
- Surveillance active-therapy removal asks confirmation.
- Environmental surveillance point removal asks confirmation.
- Bundle Library element removal asks confirmation.
- Existing destructive flows already using confirmation/governed dialogs remain unchanged.
- Existing shared AttachmentField/RecordActions confirmation behavior remains intact.

Rule: any user-visible delete/remove action must require explicit confirmation before mutation.
