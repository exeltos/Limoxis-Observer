# QA — Training QR Workflow v0.26.3

- Two distinct per-program QR tokens: check-in and completion.
- QR codes are real scannable SVGs generated locally; no external QR service.
- Public mobile self-service route: `/training-access/:token`.
- Check-in records employee, programme, attendance status and timestamp.
- Completion flow records attendance confirmation, learner feedback, quiz answers/result, competence and certificate when passed.
- Feedback and competence assessment remain separate concepts.
- Manual attendance correction remains available for governed exceptions.
- Existing v0.26.2 local demo data migrates through legacy-key fallback.
- QR can be regenerated independently for check-in or completion.
- Shared/global Observer styling is used; only generic `public-flow-*` shared self-service classes were added centrally.
- Production note: employee-code self-identification is demo fallback; production should bind QR flow to authenticated identity/SSO.
