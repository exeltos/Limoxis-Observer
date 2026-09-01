# Limoxis Observer v0.26.7 — Training Programme Workspace

- Shared compact KPI cards now use one central `module-summary-*` pattern, aligned to the Prevention Center density. Prevention itself was refactored onto the shared pattern.
- Training programmes now open as full workspaces with Summary, Participants, Materials, Learner feedback, Trainee assessment and Results.
- Participant registry supports bulk invitation queue, attendance confirmation state, and training material inclusion.
- Learner feedback uses a fixed 1–5 questionnaire for comparable trainer/training satisfaction metrics.
- Trainer-built trainee assessment supports multiple-choice and true/false questions, pass thresholds, competence evidence and retraining flags.
- Demo/local email actions queue messages only; production delivery remains a backend integration concern.

# Limoxis Observer v0.26.7 — Training & Competence

The Education/Training placeholder is now a functional, role-aware Training & Competence workspace. It follows the Observer UI contract and uses a competence-first model: programme → assignment → participation → assessment when required → competence outcome → validity/renewal → evidence.

Key additions: management and employee self-service views, programme registry, due/overdue assignments, assessment thresholds, retraining signals, competence validity and certificate evidence. See `QA/QA_TRAINING_COMPETENCE_v0.26.7.md`.

---

# Limoxis Observer v0.25.17 — Observer Design System Consolidated

This release consolidates the new Limoxis Observer UI contract across the application. It does not copy the legacy Limoxis/Healthcare Suite design. Print/Export are canonical icon-only utilities, record export actions are functional, feature date/time controls use shared Observer fields, existing dialogs inherit one common visual form language, and automated guardrails prevent these patterns from drifting again.

See `docs/OBSERVER_UI_CONTRACT.md` and `QA/observer-ui-audit-v0.25.17.md`.

---

# Limoxis Observer v0.9.2 — Workforce & Occupational Health

Clean continuation of the Limoxis Observer rebuild.

## Added in v0.9.2

- Administrative employee registry with compact search + floating advanced filters.
- Fixed/scrollable registry workspace with sticky table headers.
- New/Edit employee card using shared Department and Professional Category libraries.
- Role-gated create/edit/delete/print/export actions.
- Dedicated Occupational Health workspace with Visits and Vaccinations.
- Strict separation of HR administrative data from Occupational Health clinical data.
- Dedicated `manage_occupational_health` capability and EL/EN label.
- Occupational Health attachments foundation.
- New Supabase tables and RLS policies for employees, occupational-health visits and employee vaccinations.
- Contextual Help content continues to apply to both workspaces.
- Full EL/EN strings for the new UI.

## Governance decision

HR/staff administration does not imply access to Occupational Health clinical records. A Hospital Admin also does not automatically receive the `manage_occupational_health` capability. Clinical workforce records require an Occupational Physician role or an explicit dedicated capability.

## Verification completed in this environment

- Product i18n audit: passed, including Employees and Occupational Health.
- Clinical i18n audit: passed.
- Laboratory i18n audit: passed.
- Permission assertions: 15/15 passed.
- Relative local imports: 0 missing.
- Pure JS syntax checks: passed for changed non-JSX modules.

A complete Vite build was not executed because npm dependencies are not installed in this isolated runtime.


## v0.9.2
- Compact icon-only row actions with accessible tooltips.
- Platform Owner Role Preview with role and department scope simulation.
- Preview is UI-only and never changes backend identity or authorization.


## v0.9.2
- Role Preview is visible to Platform Owner, Demo sessions, and authenticated Development sessions.
- Production real-user sessions remain restricted to Platform Owner.
- Role Preview continues to simulate UI only; backend identity/authorization is unchanged.


## v0.12.0
- Unified full employee record.
- Registry and Occupational Health queues use Open employee instead of external edit/delete or preview cards.
- Role-aware tabs for HR, Occupational Health and employee self-service.


## v0.12.0
- Compact operational employee record header.
- Sticky tab navigation and scroll-only tab content.
- Dense structured details and compact record cards.
- Header attachment/print/export actions.

## v0.12.0
- Added employee father's name / patronymic.
- Employee administrative details now edit inline by unlocking fields.
- Training and certifications use compact list/table views.
- Certification creation uses a dedicated entry card with attachments.
- AttachmentField now includes global View/Preview actions for new attachments.

## v0.12.0
- Existing certifications open from the list for view/edit.
- Certification attachments remain contextual and support View/Preview.
- Removed the generic attachment action from the employee header.

## v0.12.0
- Shared EntityRecordShell for employee and patient record-detail screens.
- Patient and employee registries now open records by clicking the row; separate Open buttons were removed.
- Patient record unifies demographics and role-aware surveillance workflow tabs.
- Edit/Delete moved into patient details and remain permission-controlled.
- Centralized record/theme tokens for header, tabs, controls, radii and states.

- Central theme tokens (`src/styles/theme.css`) now control shared colors, radii, control heights and record layout styling.

## v0.12.0
- Fixed literal escaped newline sequences introduced in App.jsx and EmployeeRecordPage.jsx.
- Added source scan to prevent the same parser failure elsewhere.

## v0.12.0
- Fixed malformed JSX `onKeyDown` attribute in PatientsPage registry row.
- Added targeted JSX delimiter scan across the recently modified patient/employee record files.

## v0.12.0
- Compact shared EntityRecordShell header for patient and employee records.
- Shared registry memory restores scroll position and highlights the last opened row after Back.
- Patient record reduced to Summary / Surveillance / Clinical data / Documents / History.
- Surveillance is presented as a non-linear visual Journey with parallel microbiology, HAI/AMR, isolation and therapy workstreams.
- Journey nodes remain role/capability aware and open their content inside the same record workspace.

## v0.12.0
- Surveillance tab now separates active and completed episodes in a two-column selector.
- Completed episodes open a compact read-only clinical summary with optional full history.
- Active episodes open the Surveillance Journey and surface role-aware intervention/guidance cues.
- Guidance is advisory/contextual and does not turn the journey into a mandatory wizard.
- Patient demo data now includes a prior completed surveillance episode to exercise episode history.

## v0.12.0
- Active and completed surveillance episodes are now compact scrollable list tables.
- Selecting an episode opens a large overlay record card above the patient workspace.
- Active episode cards show the full role-aware Surveillance Journey and guidance cues.
- Completed episode cards show a comprehensive read-only report: hospital, patient, surveillance metadata, involved users, clinical assessment, labs, HAI/AMR, therapy, isolation, reassessment, outcome and timeline.
- Each episode detail card has dedicated print support.

## v0.12.0
- Completed surveillance episodes render as a final narrative clinical surveillance report, not an operational workspace.
- Completed reports are read-only and printable.
- A dedicated REOPEN_SURVEILLANCE capability is restricted to the Platform Owner / Super Admin.
- Reopening requires an explicit reason and records the action in the surveillance audit trail.
- Added database migration for reopened_at, reopened_by, reopen_reason and a governed reopen function.

## v0.12.0
- Laboratory registry now follows the shared row-click record pattern with scroll restoration and returned-row highlight.
- Removed the permanent right-side sample preview panel.
- Added full LaboratorySampleRecordPage using EntityRecordShell.
- Added role-aware sample receipt, result entry/validation, AST, AMR classification, critical-result communication, attachments, print/export and history.
- Laboratory remains the source of truth for sample/result/AST data; surveillance consumes these records rather than duplicating them.

## v0.12.0
- Quality workspace with Incidents, Findings, CAPA and Audits.
- Shared registry → row click → full record interaction, compact filters and returned-row memory.
- Role-aware incident reporting and Quality Manager governance.
- Inline editing in the full record, contextual attachments with View/Preview, print and history.
- Traceable source links between incidents, audits, findings and CAPA.
- New Supabase governance model and RLS foundation for the Quality domain.

## v0.12.1
- Global compact workspace geometry: headers/tabs/filters keep natural height and the list/content owns the remaining viewport.
- Removed the oversized Quality tabs surface that created empty vertical space.
- Added contextual Back navigation foundation across record screens.
- Cross-entity navigation now carries the exact origin so Back returns to the originating record instead of the destination module list.
- Quality remembers active subsection, filters, search, list scroll and returned-row highlight.
- Quality linked Patient/Surveillance/Finding/CAPA navigation preserves the originating record and active Links tab.

## v0.12.2 — Navigation & Record Access QA
- Fixed Employees registry runtime error: the shared registry hook was referenced but never instantiated.
- Fixed Patient and Employee record runtime errors: contextual `goBack` was referenced without initializing the navigation hook.
- Removed stale global tab restoration that could open an unrelated tab from a previously visited entity.
- Patients, Employees, Laboratory, Surveillance, Quality and Controls now have verified registry → record routes.
- Added filter/search/scroll memory to Patients, Employees, Laboratory, Surveillance and Quality.
- Converted Surveillance cases and Controls into shared row/card-click navigation with returned-record highlight.
- Fixed the previously dead Controls “Open” interaction by adding a real control record route.
- Quality Create/Cancel/linked-record navigation now preserves the exact originating context.
- Added dependency-free `npm run audit:navigation` regression smoke checks.

## v0.12.3
- Patients → New Patient is now a functional create flow, not a placeholder notification.
- New Patient opens a common entry card, saves to the demo data source, refreshes the registry and opens the new patient record immediately.
- Added hospital record number, date of birth, sex, department, admission date and notes to patient creation.

## v0.12.4
- New Surveillance is now functional from both the Patient record and the central Surveillance registry.
- A shared NewSurveillanceCard is used in both locations.
- Saving creates an active clinical surveillance episode, links it to the selected patient, adds it to the Surveillance registry and opens the Surveillance Journey.
- Brand-new episodes start with no fabricated clinical assessment, HAI classification, microbiology, therapy or isolation data.
- The Journey explicitly surfaces the initial clinical assessment as the first required intervention.

## v0.12.5
- New Surveillance was removed from Patient Details and now belongs exclusively to the Surveillance workspace.
- Patient/department context is inherited automatically when creating surveillance from a patient record.
- Surveillance now shows a visual flow guide and clinical guidance before an episode exists.
- Creating an episode opens directly into the active Surveillance Journey.

## v0.12.6
- Opening the Patient Surveillance tab never auto-opens an episode; users explicitly select Active or Completed episodes.
- Removed the duplicate New Surveillance action from the empty-state flow guide.
- New Surveillance no longer opens a separate setup modal: the large surveillance flow card opens immediately.
- The flow starts at Step 1 (Surveillance Start); after saving, Step 2 (Clinical Assessment) becomes active inside the same card.
- Clinical Assessment is now functional in the creation flow; subsequent clinical domains are progressively surfaced with context guidance.
- The same progressive creation flow is used from the central Surveillance Center.

## v0.12.7
- Fixed a runtime crash when opening the Patient → Surveillance tab: SurveillanceWorkspace used React useEffect without importing it.
- Added a dependency-free React hook smoke audit to catch missing hook imports before release.

## v0.12.8
- Surveillance Start inherits the patient's department and allows an explicit override for the episode.
- Next review is optional.
- Added shared ManualDateField (dd/mm/yyyy manual entry + calendar picker) and applied it to surveillance, patient creation, filters, patient-days, employee dates and Quality date editors.
- Clinical assessment was simplified: removed premature infection/HAI classification, added optional questionnaire templates and structured signs/symptoms + risk-factor checklists.
- Added Sample / Laboratory stage: a collected sample can be sent as a Laboratory request linked to the surveillance episode.
- Microbiology/HAI and later stages are guarded by prerequisites; locked steps cannot be opened.
- Active-surveillance diagrams now use the same guarded navigation model and show selected-step details below.
- Save is available independently from Save & Continue in the editable workflow steps.

## v0.12.9
- Removed duplicate Save / Save & Continue actions from the surveillance start and clinical assessment steps; each step now has one primary continuation action.
- Completed workflow stages are highlighted more clearly in both creation and active surveillance diagrams.
- Replaced the old questionnaire preset selector with a structured clinical risk screening form (recent surgery, antimicrobials, hospitalization, transfer, devices, known MDRO, immunosuppression and recent procedures).
- Clinical summary is optional. Signs/symptoms and risk factors keep structured choices and now support custom additions.
- Specimen request captures collection source/method and anatomical detail per specimen type, including blood, urine, respiratory and wound cultures.
- The specimen step has one explicit “Save & notify Laboratory” action.
- Isolation unlocks after clinical assessment and can be recorded as pre-emptive/provisional before microbiology is finalized.
- HAI/AMR and antimicrobial therapy remain guarded by validated microbiology evidence.

## v0.13.0
- Isolation now begins with an explicit Yes/No decision and supports preventive isolation before microbiology results.
- Save-only actions close the current form and show a confirmation toast.
- Active surveillance details are closed by default and open only when the user selects a flow node.
- Completed/unlocked prior stages remain clickable during active surveillance and can be edited.
- Surveillance Start, Clinical Assessment and Isolation have functional edit forms with audit timeline updates.
- Changing an existing isolation to “Not required” requires confirmation.

## v0.13.1
- Active Isolation detail now always starts with an explicit required Yes/No decision when no decision exists.
- Isolation fields appear only after Yes.
- Added authorized deletion of active surveillance episodes for erroneous/test entries.
- Delete requires a reason, removes the active episode from patient + central surveillance lists, and preserves a deletion audit snapshot in demo governance data.

## v0.13.2
- After “Save & notify Laboratory”, the New Surveillance flow remains open and moves directly to Isolation.
- Isolation always asks the explicit Yes/No decision; saving that decision closes the flow with the existing success message.
- Restored explicit Previous navigation in Sample/Laboratory and Isolation, in addition to the already available previous step in Clinical Assessment.
- Completed/available steps remain clickable in the flow rail; locked future steps remain inaccessible.

## v0.13.3
- Surveillance Center converted from large case cards to a compact operational registry.
- One row per surveillance episode with patient, department, start date, microbiology/resistance, active/isolation status and reassessment.
- Detailed clinical workflow blocks are now kept inside the surveillance record only.
- Entire row opens the record; contextual Back/highlight behavior is preserved.
- Sticky registry header and internal scrolling retained.

## v0.13.3-fixed2 (code review pass)
- Fixed invalid `package.json` (stray literal `\n` broke `npm install`/every tool in this bundle).
- Fixed `eslint.config.js` missing JSX-aware rules (`eslint-plugin-react`); lint false positives dropped from 345 to real issues only.
- Fixed 8 duplicate-key collisions in `src/core/i18n/LanguageContext.jsx` that silently shadowed translations across domains, including two with confirmed visible impact:
  - Laboratory table header/field/detail label showed the sample **status** word ("Συλλέχθηκε"/"Collected") instead of the intended **field label** ("Λήψη"/"Collected [date]") for both `collected` and `received` — renamed to `collectedLabel`/`receivedLabel`.
  - Patient-days table showed the Quality-domain phrase "Χειροκίνητη καταχώρηση" instead of "Χειροκίνητη" for manually entered rows — renamed Quality's key to `manualSource`.
  - Laboratory's clinical "Εστία / πηγή" (infection focus) label was being overwritten by the generic Quality "Πηγή" — split into `clinicalSource`.
  - Quality's audit-scope label and Patient-days' filter-scope label collided under one `scope` key — Quality's renamed to `auditScope`.
  - Remaining collisions (`period`, `phone`, `surveillanceStarted`, `optional`, `planned`→`reassessmentPlanned`) were exact-duplicate or grammar-only differences; de-duplicated to a single declaration each.
- Fixed `clinicalDemoData.js`: removed the dead boolean `isolation:true/false` field that was shadowed by the later `isolation:{...}` object on the same record (`no-dupe-keys`).
- Fixed a regression in `PatientsPage.jsx`: a hardcoded Greek fallback (`['ΜΕΘ','ICU']`) was failing the project's own `audit:clinical-i18n` / `audit:product-i18n` checks.
- Full pipeline now passes clean: `audit:clinical-i18n`, `audit:lab-i18n`, `audit:product-i18n`, `audit:product-permissions`, `audit:navigation` (18/18), `audit:hooks` (79 files), `test` (7/7), `build` (0 warnings besides the pre-existing single-chunk bundle-size notice).
- Not yet addressed: single 806KB JS chunk (no route-based code splitting yet); ~46 real (post-fix) lint findings (mostly unused imports/vars left over from refactors, a few `react-hooks/exhaustive-deps` warnings worth reviewing individually).

## v0.13.3-fixed2 (lint pass — completed)
All 46 remaining lint findings resolved. `npm run lint` is now clean: **0 errors, 0 warnings**.
- Removed confirmed dead code in `PatientClinicalRecordPage.jsx`: the `Overview` and `Isolation` display components were fully superseded by `ClinicalDataHub` and `ActiveIsolationEditor` respectively (verified no remaining call sites anywhere in the surveillance feature) — deleted. Also removed unused `pendingSamples`/`positiveSamples` computations in `SurveillanceJourney` (computed but never rendered) and several unused props/imports (`navigate`, `Circle`, `fmtDateTime`, `selectedEpisodeId`, `canCreateSurveillance`/`onNew` in `SurveillanceStartGuide`, `language` in `ReportIdentity`, `tenant` in `ClinicalAction`).
- Fixed a real stale-permissions bug in `ManagementPage.jsx`: the tabs list was memoized on `[role, language]` only, so if `membership.capabilities`/`customCapabilities` changed without role or language changing, the visible management tabs would not update to reflect the new permissions until something else forced a re-render.
- Fixed `QualityPage.jsx`: `rows` was derived via `qualityCollections[section]||[]` outside any memo, creating a new array reference on every render whenever the fallback branch was hit and silently defeating the `filtered` useMemo below it. Wrapped in its own `useMemo`.
- Fixed `OccupationalHealthPage.jsx`: `employeeMap` was rebuilt (new object reference) on every render but used inside a separate `useMemo`'s dependency array without being memoized itself — wrapped in `useMemo` so the dependent `rows` memo behaves correctly.
- Fixed `TenantContext.jsx`: `setTenantByMembership` was recreated every render; wrapped in `useCallback` (using the functional form of `setMemberships` to avoid needing `memberships` in its closure), and `membership` (which depends on role-preview state) is now itself memoized so the exported context `value` memo has a fully correct, non-spurious dependency list.
- Left two intentional "cache-bust" counters alone (`version` in `LaboratoryPage.jsx`/`SurveillancePage.jsx`, `activeStep`/`savedDraft` in `NewSurveillanceFlow.jsx`, `episodeVersion` in `PatientClinicalRecordPage.jsx`): these are bumped after mutations to force a memo/re-render to refresh from data that's mutated in place rather than replaced, so they're intentionally not read directly. Documented with `eslint-disable-next-line` comments explaining why, instead of removing them (which would reintroduce stale-list bugs).
- Cosmetic-only: removed unnecessary regex escape characters in `ManualDateField.jsx` (no behavior change).
- Full pipeline re-verified clean after these changes: `audit:clinical-i18n`, `audit:lab-i18n`, `audit:product-i18n`, `audit:product-permissions`, `audit:navigation` (18/18), `audit:hooks` (79 files), `lint` (0/0), `test` (7/7), `build` (0 warnings besides the pre-existing single-chunk bundle-size notice).
- Still open: single 806KB JS chunk — no route-based code splitting yet (next up).

## v0.13.3-fixed2 (code splitting)
- Converted all 22 feature-page imports in `src/app/App.jsx` from static imports to `React.lazy()` + a shared `<Suspense fallback={<RouteLoading/>}>` boundary per route. `AppShell`, `LoginPage`, and the auth/permission gates stay eager since they're needed immediately.
- Added `src/design-system/RouteLoading.jsx` — a small centered spinner shown while a route chunk downloads, styled to match the existing `.empty-state` look.
- Result: the single 806KB main chunk is now **563.88KB** (down ~30%), with each feature page split into its own chunk fetched on first visit (ranging from <1KB for small pages up to ~48KB for the largest, `PatientClinicalRecordPage`). The remaining main chunk is core vendor weight (React, React Router, Supabase client, auth/tenant/i18n/permissions context providers, and icons/design-system pieces needed by the app shell itself) that loads once regardless of which page is visited — further reduction would mean vendor-chunk splitting or deferring the Supabase client init, which is higher-risk and wasn't attempted here.
- Named exports required a small `lazyNamed()` helper (`lazy(() => import(...).then(m => ({ default: m[name] })))`) since `React.lazy` expects a default export and every feature page in this codebase uses named exports.
- Verified after the change: `lint` (0/0), all 6 custom audits (navigation 18/18, hooks 80 files — one more than before, the new `RouteLoading.jsx`), `test` (7/7), and `build` succeeds with per-route chunks in `dist/assets/`.




## v0.13.4 — reviewed stable baseline
- Restored repository `.gitignore` for dependencies, builds, local environment files, IDE metadata, coverage and logs.
- Route-level lazy-loading state now uses the shared EL/EN i18n system instead of hard-coded English.
- Based on the user's reviewed/cleaned v0.13.3 FIXED2 project.

## v0.14.0 — Laboratory end-to-end workflow
- Laboratory sample changes now persist to the shared laboratory source-of-truth data instead of local record-page state only.
- Added Requested → Received → Processing → Validated/Completed workflow.
- Result entry is gated until sample receipt/processing; positive validation requires an organism.
- AST is gated until a positive organism is present.
- Validating a linked result synchronizes organism, resistance, sample details and timeline back to the active Surveillance episode.
- Critical communication updates the linked surveillance sample communication timestamp.
- Laboratory registry remains compact but now surfaces source, critical/AMR flags and linked surveillance episode.
- Linked surveillance can be opened contextually from the sample record.

## v0.14.1 — Full writable surveillance loop + brand mark
- Product mark is consistently `L+` (Limoxis) on login, boot screen and application sidebar.
- After laboratory validation, active surveillance now has functional write forms for HAI/AMR classification, antimicrobial therapy, reassessment and outcome.
- Each stage writes back to the same clinical surveillance record and audit timeline.
- Completing Outcome changes the episode to completed and synchronizes the Surveillance registry item.

## v0.14.2 — executable Laboratory demo + inline patient creation
- Demo role now includes Laboratory receive/process/validate/critical-communication/resistance capabilities so the full workflow can be tested without changing login.
- Central New Surveillance starts with no preselected patient.
- User can choose an existing active patient or create a new patient inline, then continue directly into the surveillance flow.
- Laboratory workflow moves from receipt to processing and then directly to result entry; result editing opens automatically for a newly processing sample.

## v0.14.3 — Laboratory authority, hybrid libraries, atomic patient creation
- New inline patient entry uses separate first name, last name and patronymic fields.
- Inline patient is created atomically when Surveillance Start is saved; there is no separate patient-save action.
- Laboratory organism entry uses the Microorganism Library with manual fallback.
- AST and Surveillance therapy antimicrobial fields use the Antibiotic Library with manual fallback.
- Central Library now has an Advanced Antibiotics flag list; selected therapy is automatically identified and highlighted when it belongs to that list.
- Laboratory validation is now a prominent explicit action after result save.
- Microorganism/resistance shown in the patient Surveillance flow are read-only and sourced only from validated Laboratory results.
- Sample receipt action layout corrected.

## v0.14.4 — Guarded laboratory workflow and editable AST
- Laboratory record now follows a guarded sequence: Summary/Receipt → Microbiology Result → AST → Critical Communication (when applicable) → Finalization.
- Forward tabs cannot be opened manually; the workflow advances only through Receive/Start Processing/Validate/Save & Continue actions.
- Previously reached workflow tabs can be opened to go backwards and correct data.
- After final finalization, all tabs unlock for read-only review.
- AST rows can be edited or deleted before finalization.
- MIC is displayed as “Minimum inhibitory concentration” with an inline explanation.

## v0.14.5 — Final lab closure, correction mode, multi-organism and multi-therapy
- Laboratory workflow tabs wrap and fit without horizontal scrolling.
- Documents/attachments are now an explicit workflow step before Finalization.
- Finalized laboratory records are closed/read-only, but authorized users can reopen them through General Edit with a mandatory correction reason and audit entry.
- Positive microbiology can contain multiple organisms in one sample.
- AST rows can be associated with the relevant organism.
- Susceptible (S) AST rows are passed to Surveillance only as laboratory decision-support suggestions, never as authoritative therapy.
- Authorized clinical reviewers can record/edit multiple antimicrobial therapies independently of laboratory suggestions.

## v0.14.6 — Managed attachments and AST form refinement
- Shared AttachmentField now supports categorized attachments with add/edit metadata, preview and delete.
- Laboratory Documents uses laboratory-specific categories and Save & Continue now marks the step complete, shows success feedback and advances to Finalization.
- AST add/edit card has been reorganized into Identification, Susceptibility Interpretation and Method/Standard groups with more compact field sizing.

## v0.15.0 — Employee & Bulk Surveillance foundation
- Surveillance now uses an extensible subject model (`subjectType`) beginning with patient and employee subjects.
- Employee records have a Surveillance tab and can start a screening directly from the employee card.
- Central Surveillance creation offers Patient, Employee or Bulk Employee surveillance.
- Employee screenings support hand, nasal, throat and other swabs and create linked individual Laboratory requests.
- Bulk employee surveillance supports department filtering, multi-selection, multiple screening types and a common batch ID while preserving one Laboratory sample per employee/screening.
- Central Surveillance includes Patients, Employees and Bulk Surveillance registries.
- This subject/batch model is intentionally ready for the next environmental subjects: surface, room, air and water.

## v0.16.0 — Environmental Surveillance
- Central Surveillance now supports Environmental as a first-class subject domain alongside patients and employees.
- Environmental surveillance supports Surface, Room, Air and Water subjects.
- Each record captures department, location/area, exact sampling point, sampling method and date.
- Single and bulk point sampling are supported; bulk sampling creates one linked Laboratory sample per point under a common environmental batch.
- Environmental samples use the same Laboratory workflow and can be finalized/validated in the same way as patient and employee samples.
- The Surveillance registry includes a dedicated Environment view with type counts, linked result status and batch tracking.
- Shared subject architecture now covers patient, employee, surface, room, air and water.

## v0.17.0 — Environmental Plate / CFU Laboratory Workflow
- Surface and room bulk sampling can be organized either as individual samples or by Laboratory plate.
- Every sampling point can carry Plate code + Position (for example Plate A / Position 1).
- Points sharing a plate code create one Laboratory plate record while retaining individual surveillance traceability.
- Environmental Laboratory records no longer use the patient microbiology/AST workflow.
- Plate results are entered in one matrix, with result, CFU, acceptable CFU limit, automatic within/outside-limit assessment and optional organism per position.
- Individual environmental samples use the same environmental assessment logic as a single-point record.
- Finalization closes the environmental Laboratory record; authorized General Edit remains available with audit reason.
- Surveillance Center KPIs become environmental-specific when the Environment tab is active.

## v0.17.1 — Environmental workflow progress & live Surveillance refresh
- Environmental Laboratory tabs now unlock according to persisted workflow progress rather than the currently viewed tab.
- Users can move backward and then return to any previously reached stage without becoming stuck.
- Environmental result entry now supports Save Draft separately from Validate & Continue.
- Draft and validated plate/point results synchronize immediately to Environmental Surveillance.
- Surveillance Center listens for environmental updates and refreshes KPI cards and registry rows immediately.

## v0.17.2 — Smart fields & centrally managed Environmental limits
- Smart-field UX becomes a platform rule: hide irrelevant controls and lock source-of-truth values.
- Environmental acceptable limits come only from the central `environmentalStandards` library.
- No environmental threshold is hard-coded in the demo; protocol records are created centrally and require explicit configuration.
- Negative results automatically set CFU to 0 and suppress organism entry.
- Positive results reveal CFU and optional organism; within/outside-limit calculation is automatic when the central protocol has a configured limit.
- Validation is blocked for positive rows when the applicable protocol has no configured limit.
- Disabled/read-only styling is shared globally for consistent behavior across modules.

## v0.17.3 — Environmental Protocol Administration
- Added Management Center → Environmental Protocols for central configuration of sampling type, method, unit, acceptable CFU limit and active status.
- Environmental Laboratory reads the configured protocol live from this central source.
- Protocol changes are persisted locally in demo mode and immediately refresh an open Laboratory result screen.
- No arbitrary CFU threshold is supplied: administrators must enter the limit defined by their applicable protocol/method.

## v0.18.0 — Environmental registry fix + Employee Screening workflow
- Restored Environmental registry rendering in Surveillance Center so environmental samples/results are visible, not only KPI counters.
- Refined Environmental Protocol editor fields and unit/limit presentation.
- Employee samples now use a dedicated `employee_screening` Laboratory workflow, separate from patient HAI/AST workflow.
- Positive employee screening requires follow-up in Surveillance: intervention + recheck.
- Employee Surveillance KPI cards show active, positive, intervention-required and recheck-required counts.
- Recheck creates new linked Laboratory samples and keeps the original employee surveillance episode active until clearance.

## v0.18.5 — Stable Employee follow-up navigation
- Replaced transient state-only Laboratory → Employee Surveillance navigation with a stable URL deep-link using `mode=employees&employeeSurveillanceId=...`.
- Opening follow-up now always selects the Employee Surveillance registry and opens the exact screening record.
- The deep-link survives refresh/navigation and no longer depends on ephemeral React location state.
- When follow-up was opened from Laboratory, the record header provides a contextual return directly to the originating Laboratory sample.

## v0.18.6 — Optional Intervention / Recheck Flow
- Positive employee screening now has an explicit in-record flow: Positive result → Intervention → Recheck → Outcome.
- Intervention and recheck are optional; users may record data, select no intervention/no recheck, or leave the optional stage untouched.
- Intervention supports type/list-or-manual entry, notes and optional start/end dates.
- Setting a recheck date creates a linked Laboratory recheck sample; no recheck is also a valid recorded decision.
- Existing follow-up data remains editable; changing already saved follow-up requires a correction reason for traceability.


## v0.18.7 — Visible runtime version trace
- Sidebar footer now displays the exact runtime version and build id.
- Login branding also displays the app version.
- This makes stale dev-server / wrong-folder issues immediately visible.

## v0.18.7 (code review pass)
Two confirmed **runtime-breaking bugs** found and fixed — both would have crashed in production:
- `SurveillancePage.jsx`: `<Button>` was used in the employee-screening record modal (edit/save/cancel actions on positive results) without ever being imported — opening that modal would throw a ReferenceError. Fixed the import; also removed 3 now-unused icon imports (`CalendarClock`, `Pencil`, `Users`).
- `PatientClinicalRecordPage.jsx`: a plain helper function was named `useSuggestion` (applies a lab-suggested antimicrobial to the therapy draft) and called inside an `onClick` handler. Because of the `use`-prefix, this violates React's Rules of Hooks and was flagged as a hook-outside-component error — it isn't a real hook, just an unfortunate name. Renamed to `applySuggestion`; no behavior change.

Translation-key collisions (same root cause flagged in earlier versions — a flat, un-namespaced dictionary shared across all domains) reappeared with the new Environmental Surveillance / Environmental Standards features and were fixed:
- `room` (3-way): Environmental Standards' generic "Room" sampling-category option was being shadowed by the clinical "Room / Bed" patient-location field. Renamed the Environmental Standards one to `roomCategory`.
- `inactive` (grammatical gender mismatch): Employees' masculine "Ανενεργός" was shadowing Environmental Standards' neuter "Ανενεργό" for protocol status. Renamed the protocol one to `protocolInactive`.
- `samplingMethod`, `surfaceSwab`, `contactPlate`: reconciled to a single, clinically-consistent term each (kept "Τρυβλίο επαφής" — the standard microbiology term — over the less precise "Πλάκα επαφής"; kept "Επίχρισμα επιφάνειας" over the English loanword "Swab επιφάνειας").
- 15 further keys (`air`, `water`, `add`, `optional`, `firstName`, `lastName`, `other`, `open`, `notRequired`, `notScheduled`, `completeRequiredFields`, `roomSampling`, `passiveAir`, `activeAir`, `waterSampling`) were exact-value duplicates within the same language block — deduplicated with no functional change.
- Build now reports **0 duplicate-key warnings** (was 40+).

Dead code removed (each verified to have zero remaining call sites before deletion): `resultStarted` and an unused `positions` prop in `LaboratorySampleRecordPage.jsx`; the fully-superseded `EditableLibraryField`/`EditableField` components (superseded by `EditableSelect`); an unused `useMemo` import in `EnvironmentalSurveillanceFlow.jsx`; `initialPatient` in `NewSurveillanceFlow.jsx`; the `Reassessment`/`Outcome`/`HaiClassification` display components in `PatientClinicalRecordPage.jsx` (superseded again, same pattern as v0.13.3's `Overview`/`Isolation` — worth checking for a recurring copy-forward-without-cleanup habit); a disconnected `requestedEmployeeRecord` URL-param state in `SurveillancePage.jsx` that was fully superseded by the `requestedRecordId`-prop deep-link mechanism from v0.18.5 but never removed.

Several `react-hooks/exhaustive-deps` warnings were intentional narrow-dependency patterns (cache-bust counters, or avoiding clobbering in-progress user edits on every parent re-render) rather than bugs — documented in place with `eslint-disable-next-line` comments explaining why, rather than "fixed" by adding the suggested dependency (which would have reintroduced stale-list or data-loss bugs).

Full pipeline verified clean: `lint` (0/0), all 6 custom audits (navigation 18/18, hooks 86 files), `test` (7/7), `build` (0 duplicate-key warnings; main chunk 615KB, per-route code-splitting from the v0.13.3 pass still intact).

## v0.18.7 (i18n namespacing — phase 1)
Started structurally preventing the translation-key-collision bug class (hit in v0.12.2, v0.13.3, and again this version) rather than continuing to catch it reactively via lint.

**Why not a full rename of every key:** ~500 translation keys exist, but 153 call sites use a *dynamic* key read from data (`t(record.status)`, `t(item.due)`, etc.) — these are status/verb vocabulary (`active`, `open`, `pending`...) intentionally shared across domains and compared with `===` throughout the codebase. Prefixing these would mean touching the underlying enum values everywhere they're set and compared — high risk, low reward, since these were never the source of an actual collision (every collision found across all 3 versions was a *literal* `t('someKey')` call for a domain-specific field label). So the scope was narrowed to literal, domain-exclusive keys only.

**What changed:** `src/core/i18n/LanguageContext.jsx` — `t()` now supports dot-namespaced keys (`t('domain.key')`) alongside the existing flat keys, via a small `lookupTranslation()` helper, with no change to the flat-key lookup path. As a first migrated domain, all 30 keys used exclusively by `EnvironmentalStandardsPanel.jsx` (the file responsible for every "room"/"inactive"/"samplingMethod"-type collision found so far) were moved into a nested `environmentalStandards` namespace and their call sites updated to `t('environmentalStandards.xxx')`. Shared keys used by other files too (`active`, `save`, `cancel`, `status`, `samplingMethod`, etc.) were deliberately left flat/untouched.

Because a namespaced key lives at a different object path (`productStrings.el.environmentalStandards.room` vs `productStrings.el.room`), it is now **structurally impossible** — not just lint-detected — for another domain to silently shadow it, even if that domain reuses the exact same key name.

**Bonus find while migrating:** 4 keys referenced by `EnvironmentalStandardsPanel.jsx` (`enterProtocolLimit`, `measurementUnitHelp`, `protocolCodeHelp`, `protocolCodeLockedHelp`) were never defined anywhere in the dictionary — the UI was silently displaying the raw untranslated key as placeholder/hint text (a bug the i18n audits don't catch, since they check for *hardcoded Greek*, not *missing entries*). Wrote proper EL/EN copy for all 4 as part of the migration.

**Scope note — this is phase 1, not a full migration:** the remaining ~450 flat keys are still protected only by ESLint's `no-dupe-keys` (which has reliably caught every collision so far, just reactively). `EnvironmentalStandardsPanel.jsx` was chosen first because it's the confirmed repeat offender. Migrating the rest of the codebase this way is a larger, multi-session effort — worth doing incrementally as other domains show up as repeat offenders, rather than all at once.

Verified after migration: `lint` (0/0), all 6 audits, `test` (7/7), `build` clean (0 duplicate-key warnings).

## v0.18.7 (i18n namespacing — phase 2: Quality)
Migrated the Quality domain (`QualityPage.jsx`, `QualityCreatePage.jsx`, `QualityRecordPage.jsx`) using the same pattern as phase 1, with one important refinement learned along the way.

**The refinement — not every domain-exclusive key is safe to namespace.** The first pass moved 8 keys that turned out to double as raw *data values* read back dynamically via `t(someField)`, not just as static labels:
- `audit`, `incident` — raw values of `draft.source` (Finding source type), redisplayed via `t(draft.source)`.
- `corrective`, `preventive`, `internal`, `external` — raw values of `actionType`/`auditType`, redisplayed via `options={[...].map(x=>[x,t(x)])}`.
- `recordCreated`, `recordUpdated` — raw values of `history[].action`, redisplayed via `t(x.action)` in the record's audit trail.

Namespacing these would have broken the dynamic lookups (the raw stored value is still e.g. `'corrective'`, not `'qualityRecords.corrective'`), silently showing the untranslated key in the UI. All 8 were moved back to flat keys after the build/lint pass didn't catch this (dynamic-key lookups are invisible to both `no-dupe-keys` and the custom i18n audits — this class of regression can only be caught by tracing each key's actual call sites by hand, which is what makes namespacing the *remaining* ~450 keys a genuinely slow, careful task rather than a mechanical one).

**What ended up namespaced (15 keys, all confirmed static-only):** `capa`, `completedDate`, `effectiveness`, `effectivenessDue`, `finding`, `linkedRecords`, `manualSource`, `newQualityRecord`, `noLinkedRecords`, `qualitySubtitle`, `recordDeleted`, `reportedBy`, `searchQuality`, `sourceId`, `auditScope` — moved into `qualityRecords.*` (named `qualityRecords` rather than `quality` because a flat `quality` key already exists as the sidebar nav label and would have collided with the namespace object itself).

Verified after this pass: `lint` (0/0), all 6 audits, `test` (7/7), `build` clean.

## v0.18.7 (i18n namespacing — phase 3: Controls)
Migrated the Controls domain (`ControlsPage.jsx`, `ControlRecordPage.jsx`) — the smallest and cleanest migration so far. All 6 domain-exclusive keys (`activeAssignments`, `controlsAssignedSubtitle`, `controlsManageSubtitle`, `controlsTrackingHint`, `newControl`, `toExecute`) were static-only page-header content with no dynamic `t(x)`-style lookups anywhere in the domain, so no keys needed reverting this time. Moved into `controlsPanel.*` (named `controlsPanel` rather than `controls`, same reason as `qualityRecords` — a flat `controls` key already exists as the sidebar nav label).

Verified: `lint` (0/0), all 6 audits, `test` (7/7), `build` clean.

**Domains namespaced so far:** `environmentalStandards` (30 keys), `qualityRecords` (15 keys), `controlsPanel` (6 keys) — 51 keys structurally protected. Remaining candidates worth checking next: Patient Days / Management, Employees, Laboratory.

## v0.18.7 (i18n namespacing — phase 4: Employees)
Migrated the Employees domain (`EmployeesPage.jsx`, `EmployeeRecordPage.jsx`) — the largest domain migrated so far (39 candidate keys) and the one that surfaced two more variants of the dynamic-lookup trap phase 2 first uncovered:

- **`inactive` was excluded from the start**, before any file editing: `t(employee.employmentStatus)` reads this dynamically, and `employmentStatus` can literally be `'inactive'` in the data. Caught by tracing every candidate key's usages for raw-value patterns *before* touching the dictionary this time, rather than discovering it mid-migration.
- **`training` and `evaluations` had a new failure mode**: not a direct `t(x.field)` call, but an indirect one — a shared `SectionTitle({t, title})` component internally calls `t(title)`, and several call sites pass a literal `title="training"` / `title="evaluations"` string prop. Namespacing these broke that indirect lookup. Both were reverted to flat keys (added alongside the other nav-label strings, since neither previously existed as a standalone flat key) and their two *other*, genuinely static call sites (tab labels) were reverted to match.

**What ended up namespaced (37 keys):** all of `activeEmployees`, `auditVisibleAccordingToRole`, `basicDetails`, `certificate`, `certificateAdded`, `certificateDetails`, `certificateNumber`, `certificateUpdated`, `certificatesDocuments`, `confirmEmployeeDelete`, `deleteEmployee`, `departments`, `editCertificate`, `editEmployee`, `email`, `employeeAdminGovernance`, `employeeAdministrativeData`, `employeeDeleted`, `employeeDetailsTab`, `employeeFullRecordSubtitle`, `employeeRecord`, `employeeRecordCreated`, `employeeSurveillanceRecordHelp`, `employeeUpdated`, `employeesRegistrySubtitle`, `evaluationGovernance`, `hireDate`, `issueDate`, `issuer`, `myEmployeeRecordSubtitle`, `myProfile`, `newCertificate`, `newEmployee`, `openCertificateEdit`, `openCertificateView`, `selfEvaluationReadOnly`, `trainingTitle` — into `employeesRecords.*` (named `employeesRecords`, same collision-avoidance reason as the other namespaces — a flat `employees` nav label already exists).

**Updated methodology note:** the safety check is now "trace every candidate key's usages *before* editing the dictionary" rather than "migrate then discover breakage via manual review" — catches direct (`t(x.field)`) and indirect (helper components that call `t()` on a passed-in prop) dynamic lookups in the same pass.

Verified: `lint` (0/0), all 6 audits, `test` (7/7), `build` clean.

**Domains namespaced so far:** `environmentalStandards` (30), `qualityRecords` (15), `controlsPanel` (6), `employeesRecords` (37) — **88 keys** structurally protected. Remaining candidates: Patient Days / Management, Laboratory, Surveillance/Clinical.

## v0.18.7 (i18n namespacing — phase 5: Laboratory)
Migrated the Laboratory domain (`LaboratoryPage.jsx`, `LaboratorySampleRecordPage.jsx`) — the largest yet, 135 keys.

**Tooling bug found and fixed mid-migration:** the extraction script used a plain substring match (`key + ":'"`) to locate each candidate key's declaration. This silently matched inside *longer* key names that happen to end the same way — `assessment` matched inside `reassessment` and `flowAdvice_assessment`; `organisms` matched inside `libraryMicroorganisms`. Caught because the exact-match count came back as 4 and 12 instead of the expected 2, rather than because anything visibly broke — a reminder that even the migration tooling itself needs the same "verify before trusting" discipline applied to the actual translations. Fixed by adding a proper word-boundary check (not preceded by a letter, digit, or underscore) before re-running.

**Dynamic-lookup exclusions (5 keys, confirmed via the same per-key usage trace as phase 4):** `processing`, `received`, `requested` are `sample.status` enum values shown via `t(sample.status)`; `contaminated`, `inconclusive` are `sample.result` enum values shown via `t(sample.result)`. All five stayed flat.

**Separate, pre-existing bug found (not caused by this migration, left as-is):** the critical-communication method selector stores `'in_person'` / `'secure_message'` (snake_case) but the dictionary only ever defined `inPerson` / `secureMessage` (camelCase); `t(row.method)` at the display table therefore already showed the raw untranslated value before this migration touched anything, and continues to after — worth a follow-up ticket, but out of scope for a namespacing pass. Noting it here so it isn't lost.

**What ended up namespaced (135 keys)** — into `laboratoryRecords.*` (same collision-avoidance naming reason as the other four namespaces — a flat `laboratory` nav-label key already exists).

Verified: `lint` (0/0), all 6 audits, `test` (7/7), `build` clean, zero orphaned call sites (cross-checked every migrated key still has no stray flat `t('key')` reference left in the two Laboratory files).

**Domains namespaced so far:** `environmentalStandards` (30), `qualityRecords` (15), `controlsPanel` (6), `employeesRecords` (37), `laboratoryRecords` (135) — **223 keys** structurally protected. Remaining candidates: Patient Days / Management, Surveillance/Clinical (the largest and most tangled domain left — expect more dynamic-lookup exclusions there given how much of `PatientClinicalRecordPage.jsx` reads status/type fields dynamically).

## v0.18.7 (i18n namespacing — phase 6: Surveillance/Clinical — final domain)
Migrated the Surveillance/Clinical domain across all 5 files (`EmployeeSurveillanceFlow.jsx`, `EnvironmentalSurveillanceFlow.jsx`, `NewSurveillanceFlow.jsx`, `PatientClinicalRecordPage.jsx`, `SurveillancePage.jsx`) — the largest and most tangled domain, 396 total keys, 277 exclusive candidates.

**Dynamic-lookup exclusions (15 keys):** found via the same per-key raw-value cross-reference against every demo-data file in the domain — `clinicalImprovement`, `confirmed`, `resolved`, `suspected`, `bloodstreamInfection`, `samples`, `surveillanceStarted`, `urinaryTractInfection`, `ventilatorAssociatedPneumonia`, `continueIsolation`, `continueTreatment`, `inProgress`, `overdue`, `pending`, `unknown` — all are `status`/`type`/`detail`/screening-answer enum values displayed via `t(record.field)`-style dynamic lookups. Stayed flat.

**A new, more serious variant of the dynamic-lookup trap — cross-domain shared component usage:** `confirm` and `confirmAction` looked exclusive to Surveillance by the same file-count check used in every phase so far, but that check only scanned `features/*`, `app/*`, and `design-system/*` — it never looked inside `src/core/`. These two keys are the default title/button text of the **app-wide shared confirmation dialog** (`src/core/feedback/FeedbackContext.jsx`), used by every domain in the app whenever code calls `confirm({...})` without overriding the title. Namespacing them would have broken the confirm dialog's default text for Quality, Employees, Controls, Laboratory, and everywhere else that relies on the default rather than passing an explicit title. Caught only because a broader post-migration retroactive scan (see below) was run this time, not the per-domain usage count that had been sufficient for every domain up to this point.

**Retroactive audit added as a result:** re-scanned all 5 already-migrated namespaces (`environmentalStandards`, `qualityRecords`, `controlsPanel`, `employeesRecords`, `laboratoryRecords`) against every file in `src/core/`, `src/design-system/`, and `src/app/` to confirm none of them have the same blind spot. All five came back clean — this was specific to Surveillance's use of the shared confirm dialog with a custom title. Also re-scanned all remaining `clinicalRecords` keys against every file outside `features/surveillance/` (not just core/design-system/app) as a final sweep — zero hits.

**Content bugs found and fixed while auditing (unrelated to namespacing, found because every candidate key's actual declaration was being individually verified):**
- 7 keys called via `t(...)` in the Surveillance UI had **no dictionary entry at all** in either language — `type`, `start`, `end`, `hospital`, `patronymic`, `selectPatient`, `startedAt` — meaning the UI was showing the literal untranslated key as text (e.g. a column header literally reading "type"). Same class of bug as the 4 found in phase 1 (Environmental Standards). Wrote proper EL/EN copy for all 7.
- 3 keys (`correctionReason`, `correctionReasonHelp`, `correctionReasonPlaceholder`) had a Greek entry but **no English one at all** — English-mode users were silently shown Greek text for these three labels (a real localization bug, not a crash). Added the missing English copy.
- `closeSurveillance` was declared twice with an identical value in each language block — harmless, deduplicated.

**Extraction tooling bug found and fixed (same class as phase 5's `assessment`/`organisms` substring bug, different specific instance):** none surfaced this time, but the corrected word-boundary regex from phase 5 was reused throughout, and every one of the 260 final candidate keys verified at exactly 2 declarations (EL+EN) before removal — zero silent mismatches.

**What ended up namespaced:** 260 keys (277 candidates − 15 dynamic-lookup exclusions − 2 false positives that were never real `t()` calls, `mode` and `employeeSurveillanceId`, which turned out to be `searchParams.get(...)` calls the original extraction regex mistook for `t(...)` due to `get(` ending in the same two characters) into `clinicalRecords.*` (named `clinicalRecords`, same collision-avoidance reason as every other namespace — a flat `surveillance` nav-label key already exists). 311 call sites updated across the 5 files.

Verified: `lint` (0/0), all 6 audits, `test` (7/7), `build` clean, zero orphaned flat-key call sites in the 5 migrated files, zero cross-domain leakage for any of the 6 namespaces now in place.

## Summary — i18n namespacing project complete
**All domains with meaningful key volume are now namespaced:** `environmentalStandards` (30), `qualityRecords` (15), `controlsPanel` (6), `employeesRecords` (37), `laboratoryRecords` (135), `clinicalRecords` (260) — **483 keys** structurally protected against the cross-domain collision bug that recurred in v0.12.2, v0.13.3, and the start of v0.18.7. The remaining flat keys are genuinely cross-cutting, shared vocabulary (status enums, `save`/`cancel`/`edit`/`delete`, `yes`/`no`, and similar) that are *correctly* shared by design, not collision risk — these should stay flat.

**Methodology, refined over six passes, for anyone extending this further:**
1. Extract candidate keys used in exactly one feature file — but check usage against *all* of `src/features/`, `src/core/`, `src/design-system/`, and `src/app/`, not just features (phase 6 found this gap the hard way).
2. Before touching the dictionary, trace every candidate key for dynamic `t(x.field)`-style lookups and cross-reference against the actual raw enum/data values in that domain's demo-data files — not just literal `t('key')` calls. Also check for indirect lookups through shared helper components that call `t()` on a passed-in prop (phase 4's `SectionTitle` bug).
3. Verify each key's declaration count with a word-boundary-safe regex (`(?<![a-zA-Z0-9_])key:'`), not a plain substring match — plain substrings silently match inside longer key names (phase 5's `assessment`/`organisms` bug) and inside `variable(...)` call expressions that happen to end in `t(` (phase 6's `mode`/`employeeSurveillanceId` false positives).
4. After migrating, grep every migrated key across the *entire* `src/` tree outside the domain's own folder to catch shared-component reuse (phase 6's `confirm`/`confirmAction` finding) — not just the domain's own files.
5. Run the full pipeline (`lint`, all 6 audits, `test`, `build`) after every domain, and additionally grep for orphaned flat-key references left behind by the migration itself.









## v0.18.8 — Application Shell Refinement
- Consolidated Help, Notifications and Language into one compact utility group in the top-right header.
- Standardized shell controls through central theme tokens instead of per-control visual styling.
- Kept the notification bell fully visible with a clearer unread indicator.
- Reduced visual weight of user/tenant controls and added responsive compaction for narrower desktop widths.
- Locked the application shell to the viewport; sidebar/topbar remain stable while the content workspace owns scrolling.
- Preserved existing routes, permissions, role preview, tenant switching and business logic.

## v0.18.9 — Employee follow-up correction
- Employee screening follow-up remains visible and editable after a positive case is later cleared/completed.
- Added explicit ointment/topical treatment option under employee intervention.
- Existing intervention/recheck corrections require a reason and append an audit timeline entry.
- Completed/cleared employee screenings retain correction access instead of becoming effectively read-only.

## v0.19.0 · Employee screening treatment correction
- Employee screening laboratory records now include intervention/treatment capture directly in the Screening Result tab.
- Supports ointment/topical treatment, nasal ointment, other treatment, instructions, start date and planned end date.
- Finalized employee screening records now support governed General Edit/reopen with mandatory correction reason, matching the environmental laboratory correction pattern.
- Treatment data synchronizes back to linked Employee Surveillance follow-up.


## v0.25.8 — Global long-text editing
- All textarea fields receive a compact ⛶ expand control.
- Expanded editor supports Apply/Cancel and read-only viewing.
- Native vertical resize remains available.
- Committee registry rows now use pointer cursor and hover feedback.

## v0.25.9 — Committee Governance Workspace
- Committee record summary upgraded with governance KPIs and attention watch.
- Added annual IPC action plan with measurable objectives, baseline, target, owner, deadline and status.
- Decisions/actions now support lifecycle status and overdue highlighting.
- Existing legacy committee members are normalized into the historical member model without deleting stored data.
- Seed ENL is aligned with the IPC committee template and includes realistic governance demo data.
- Meetings capture date, time, location and agenda; finalized minutes remain governed.

## v0.25.16 — Observer UI stabilization

This release intentionally resets the committee work to the stable v0.25.10 Observer base and reintroduces only the approved governance functionality through shared Observer patterns.

### Product-wide UI contract
- Print and export actions rendered through `RecordActions` are always icon-only (tooltip + aria label).
- Added `ObserverDialog` as the canonical modal form shell.
- Added `ExpandableTextBlock` for large read-only text; editable text continues to use the global textarea expander.
- Added `tools/check-observer-ui-patterns.mjs` and included it in `npm run check` to prevent committee-only form shells and visible Print/Export text buttons from returning.
- The print action inside the controls execution form was aligned to the same icon-only pattern.

### Committees
- Member, new meeting, decision/action and annual-objective forms now use the shared Observer form geometry, date component, header/close control and footer actions.
- Meeting editing is one continuous workspace (no step wizard): basic data, attendance/quorum, discussion topics/decisions, optional follow-up, approval summary.
- Minutes are structured as `discussion topic -> decision/conclusion`, with optional action/owner/deadline/priority.
- Follow-up actions created from minutes are added to the committee action tracker without duplicate re-entry.
- Attendance is recorded per active committee member and quorum is calculated from voting members when the rule is computable.
- Completing a meeting creates approval requests only for members recorded as present and creates compact email-outbox payloads for recipients with an email address. External delivery still requires the platform transactional-email provider/Edge Function.
- Existing legacy meeting agenda/notes data is normalized into the structured topic model without deleting old records.

### Verification performed in this environment
- Full JSX/JS syntax parse through TypeScript: passed for all `src` files.
- Navigation smoke audit: 18/18 passed.
- React hooks smoke audit: passed (116 source files).
- Product permission audit: 22 assertions passed.
- Observer UI pattern audit: passed.

A full Vite production build could not be executed in this sandbox because npm dependency retrieval cannot resolve `registry.npmjs.org` (EAI_AGAIN). This is an environment/network limitation; the source-level parser and static smoke checks above were completed successfully.

## v0.25.17 (code review pass)
This environment has network access, so the full `npm run check` pipeline (lint, all 7 audits, tests, build) was run for the first time on this codebase — and it caught what the previous environment's TypeScript-parse-only check couldn't.

**4 confirmed runtime-crash bugs found and fixed** — all `no-undef` errors, meaning ESLint's parser found real references to variables that don't exist. A TS/JS syntax parse alone (as noted above) cannot catch these; only a proper lint pass with scope analysis can:
- **Prevention page:** the shared `EditCell` component (used by all 4 tables — Hand Hygiene, Waste, Antiseptics, Bundles) called `t('edit')` without `t` ever being passed in as a prop. Any user with edit rights on any of those 4 registries would have crashed the page. Fixed by adding the missing `t` prop and updating all 4 call sites.
- **Surveillance export:** referenced `employeeRows`, `employeeBatches`, `environmentalRows` — none of which exist in the file. The correct, already-imported names (`employeeSurveillanceRecords`, `employeeSurveillanceBatches`, `environmentalSurveillanceRecords`) were substituted in.
- **Surveillance record creation:** referenced `actor.name` with `actor` never defined, despite `useAuth`/`auditActorFromAuth` already being imported. Added the missing `const actor=useMemo(()=>auditActorFromAuth({profile,user}),[profile,user])`, matching the exact pattern already used in every sibling file (Laboratory, Quality, Prevention, NewSurveillanceFlow).
- **Patient Clinical Record print button:** used the `Printer` icon without importing it. Added the import.

**A real access-control gap found and fixed:** `LaboratoryPage.jsx` computed `canAccessRecord` from `useTenant()` but never applied it to the samples list — unlike `EmployeesPage.jsx` and `PatientsPage.jsx`, which both filter their rows with `.filter(x=>canAccessRecord(x))`. This meant a department-scoped user could see every lab sample across all departments, not just their own. Verified the fix against `recordWithinRoleScope`'s actual matching logic (`department`/`departmentId`/`organizationId` fields) before applying it.

**A real stale-tab bug found and fixed** in `EmployeeRecordPage.jsx`: the visibility of the "Surveillance" tab depends on `canSeeSensitiveEmployeeHealth`, but that value was missing from the tabs `useMemo`'s dependency array — the same class of bug fixed in `ManagementPage.jsx` during the v0.13.3 review. If a user's sensitive-health visibility changed without `canAdmin`/`canOccupational`/`canTraining`/`selfMode` also changing, the tab wouldn't update to reflect it.

**Remaining ~24 lint findings resolved**, each individually verified before fixing rather than blindly deleting:
- Confirmed-safe removals: unused icon imports across 6 files, an unused `execution` prop in `ControlCancellationModal` (the caller already tracks its own reference), an unused `confirm` destructure in `QualityRecordPage` (delete/void has its own governance flow in the child `QualityDetails` component, not a missing confirmation dialog), a `recordAction` function in `PatientClinicalRecordPage` fully superseded by the newer `PrintExportActions`/`headerActions` pattern, an unused `Kpi` component and `canCreateSurveillance` variable in `SurveillancePage` (the latter's gating is already handled by `RecordActions`'s `actionCapabilities`), and a `location` variable in `PreventionPage`.
- `react-hooks/exhaustive-deps` warnings for `version`-style cache-bust counters (Controls, Prevention, `useRecordSequenceNavigation`) and one `committeeApprovalVersion` counter — same established pattern from earlier reviews; documented with `eslint-disable-next-line` rather than "fixed" by adding the dependency, which would reintroduce stale-list bugs.
- `AntisepticEntryModal`'s `range` was wrapped in its own `useMemo` (previously recomputed inline each render, which is what caused the missing-dependency warning) for a cleaner, warning-free fix.
- `CommitteesPage.jsx` had 5 findings from what looks like leftover scaffolding: unused `nextCommitteeId`/`saveCommittees` imports and a `setRows` that was never called (the list already reads fresh data via `loadCommittees()` on every mount, matching the pattern other list pages like `QualityPage` use, so the setter added no value), an unused `notify`, and a dead `csv` variable inside a working `exportCsv()` function that already built its output from a separate `text` variable.

Full pipeline verified clean: `lint` (0/0), all 7 custom audits (navigation 18/18, hooks 119 files, observer-ui pattern check), `test` (7/7), `build` clean (0 duplicate-key warnings; largest chunk 632KB, per-route code-splitting from the v0.13.3 pass still intact across the new Committees pages).

## v0.26.36 (code review pass)
This version shipped several serious regressions — see below. Everything was fixed and verified against the full `npm run check` pipeline (previously not run before this version was packaged, based on how many basic issues were present).

**The build did not compile at all.** `LibrariesPanel.jsx` imported `Capsules` from `lucide-react`, an icon name that doesn't exist in the installed version — `npm run build` failed outright with zero deployable output. Fixed by using `Tablets` (the closest available icon for the antibiotics library category). Also wrote a one-off script scanning every `lucide-react` import in `src/` against the package's actual export list to confirm this was the only invalid icon name in the codebase.

**A real stale-list bug** in `EmployeesPage.jsx`: `employeeRows` had been converted from a static demo-data import into real component state (`useState(loadEmployees)`, updatable via the new `EmployeeCreateDialog`), but the `rows`/`departments` `useMemo`s were never updated to depend on it. A newly created employee wouldn't appear in the registry table or department filter until something else (language, search query) forced a recompute — the KPI counters at the top of the page updated correctly since they read `employeeRows` directly, making the table's staleness easy to miss in a quick look.

**Two custom audits were failing:**
- `audit:product-i18n` — a large amount of hardcoded Greek text had been introduced across three files with no `t()` calls at all: the entire new `IndicatorsPage.jsx` (57 strings), most of `LibrariesPanel.jsx` (16 strings), and a chunk of `ManagementPage.jsx`'s organization-settings and external-references sections (61 strings), plus one hardcoded toast in `EmployeesPage.jsx` (whose correct key, `employeeCreated`, already existed in the dictionary — it just wasn't used). All were moved into three new namespaces (`indicatorsRecords`, `librariesPanel`, `managementPanel`), following the same domain-isolation approach used throughout this project's i18n work, with the same discipline: every candidate key's usage was traced for indirect/dynamic lookups before being namespaced.
  - Two helper components (`IndicatorDialog`, `IndicatorEditorDialog` in Indicators; `ManagementOverview`, `OrganizationPanel` in Management) didn't receive `t` as a prop at all — a straightforward miss when the surrounding page was written directly in Greek instead of through the translation layer, since without `t()` calls there's no reason to notice its absence until you go to add them.
  - While translating `ManagementPage.jsx`'s facility-type dropdown, translating the `<option>` display text alone would have silently broken the field for English-mode users: the component reads the select's value from option text content, and the stored default was the literal Greek string `'Γενικό Νοσοκομείο'`. Rather than leave that mismatch, the field was switched to stable value identifiers (`'general'`, `'university'`, ...) with a small `facilityTypeLabel()` helper that also recognizes the old Greek strings, in case any already existed in a user's saved `localStorage` settings.
  - The `externalSources` array (WHO/EUCAST/EODY/CDC reference metadata) was moved out of `ManagementPage.jsx` into `managementData.js`, matching how every other demo dataset in this codebase lives in a dedicated data file rather than inline in the page component — and added bilingual `versionEn`/`scopeEn` fields so the reference table renders correctly in English instead of falling back to the Greek text.
- `audit:observer-ui` — `CommitteesPage.jsx` used CSS classes named `committee-dialog-member-*`, tripping the audit's check for legacy non-Observer form shells even though the component itself already correctly uses the shared `ObserverDialog` wrapper; the class names were just a naming leftover from before that migration. Renamed to `committee-member-*` in both the JSX and `global.css`, and removed an entirely orphaned `.committee-dialog` CSS rule that no longer had any element referencing it.

**A real UX bug found while fixing the above:** `CommitteeCreateDialog`'s "remove member" action called `confirm(...)` without the component ever calling `useFeedback()` for itself. Because `confirm` is *also* a built-in browser global (`window.confirm`), ESLint's `no-undef` didn't catch it — the component was silently falling through to the native, unstyled browser confirmation dialog instead of the app's own modal. Added the missing `useFeedback()` call.

**Remaining lint findings (~28) resolved**, largely unused imports/props across Committees, Documents, Indicators, and LIRA, plus a 9-occurrence pattern of empty `catch{}` blocks around `localStorage`/`fetch` calls (intentional best-effort error handling, consistent with the rest of the codebase) that only needed an explanatory comment to satisfy `no-empty`. One redundant `pct()` helper in `indicatorEngine.js` was removed (a more general calculation already existed). `src/lib/qrCode.js`'s two `no-redeclare` findings are inside a vendored third-party QR-code library using old `var`-based loops; left as-is with a file-level disable comment rather than modified, to avoid diverging from upstream.

**Flagged but not resolved — worth a follow-up with whoever built the LIRA AI page:** `LiraPage.jsx` had two unused components, `Metric` and `SignalRow`, that (unlike similar dead code found in earlier reviews) don't appear to be superseded by an equivalent replacement anywhere else in the file — no other code renders anything with matching `module-summary-metric` or `lira-signal-row` styling. This looks more like an unfinished feature (a metrics summary strip and an analysis signal list that were scaffolded but never wired into the render tree) than leftover cleanup. Removed to satisfy lint since leaving unused code isn't itself a fix, but flagging this here rather than treating it as confirmed-safe deletion like the other cases in this pass.

Full pipeline re-verified clean after all fixes: `lint` (0/0), all 7 custom audits (navigation 18/18, hooks 129 files, observer-ui pattern check now passing), `test` (7/7), `build` succeeds (0 duplicate-key warnings, largest chunk 648KB).

## v0.26.71 "EN UI Audit Batch10" (code review pass)
This version added real infrastructure the project needed — a GitHub Actions CI workflow running `npm run check` on every push/PR, Netlify deployment config, and two new audits (`audit:english-parity`, checking all 1346 dictionary keys have a matching EN entry; `audit:help-coverage`, checking an 18-section role-aware help manual has EL/EN parity). All 9 audits passed cleanly on this codebase, and `build`/`test` were fine — but `lint` was not clean, and it caught something the other 11 checks in the pipeline couldn't.

**6 confirmed runtime-crash bugs, the largest batch found across this project's review history.** This version introduced a new inline-ternary pattern for English support (`en?'English text':'Greek text'`, with `en` derived per-component via `const en=language==='en'`) used alongside the established `t()` dictionary system — correctly declared in most places, but missing entirely in 6 separate functions:
- `NewMeetingDialog` and `MeetingDialog` in `CommitteeRecordPage.jsx` — the "new meeting" and "meeting & minutes" dialogs for committees, each with dozens of `en` references and zero declarations. Both would crash immediately on open, regardless of UI language (a `ReferenceError` for an undeclared variable isn't a translation problem, it's a hard crash).
- `ProgramOverview`, `Participants`, `Materials`, `AssessmentBuilder`, and the `QrToolbarAction` helper plus the `openTrainingMaterial` async helper in `TrainingPage.jsx` — the overview, participants, materials, and assessment tabs of every training program record, plus the QR check-in/completion buttons and the "open material" action. All were separate function components/helpers that received data as props but not `en`.

All were fixed the same way: passing `en` down as a prop from the parent scope that already derived it correctly, rather than having each function call `useLanguage()` independently (matching how the rest of the codebase already threads `t`/`language` through prop chains).

**One additional real bug found while fixing the above:** `AnnouncementsPanel.jsx`'s department-list `useMemo` read `en` but had an empty dependency array — switching the UI language wouldn't update the already-rendered department names. Added `en` to the dependency array.

**Cleanup:** ~22 lint findings remained after the crash fixes, almost all a single repeated pattern — `const {language,locale}=useLanguage()` destructuring `locale` when only `language`/`en` were ever used — across `CommitteeRecordPage.jsx`, `DocumentRecordPage.jsx`, and `TrainingPage.jsx`. Also found and removed `language`/`en` in 5 `TrainingPage.jsx` dialogs (`DeleteParticipantDialog`, `MaterialDialog`, `QuestionDialog`, `ProgramDialog`, `CompletionDialog`) that derived `en` but never referenced it anywhere in their body — these dialogs' content is entirely Greek with no English variant at all, which is a separate, pre-existing i18n gap worth a future look but out of scope for this pass. One more `react-hooks/exhaustive-deps` false positive (`NotificationContext.jsx`'s birthday check, driven by a periodic 60-second `clock` ticker) was documented with `eslint-disable-next-line` rather than "fixed", consistent with every other cache-bust counter found in this project.

Full pipeline re-verified clean after all fixes: `lint` (0/0), all 9 custom audits (english-parity 1346/1346, help-coverage 18 sections, navigation 18/18, hooks 136 files, observer-ui), `test` (7/7), `build` clean (0 duplicate-key warnings, largest chunk 723KB).




## Frontend ↔ Live Database Parallel Functionality Check (2026-09-01)
Systematic cross-check between what the frontend code expects and what actually exists in the live Supabase project (`wnnssaicdsdgesysaamv`), covering every `.from()` table reference, every `.rpc()` call, and the generic data-access repository's cloud/local routing.

**RPC calls — both verified live and correct.** The entire frontend + Edge Function codebase calls exactly 2 database functions: `create_patient_admission` and `platform_report_summary`. Both confirmed to exist in the live database (the second one only because it was restored during this session's audit — see the "Live database backend audit" section above).

**Direct `.from()` table references — all correct.** `account_invitations`, `departments`, `organization_members`, `organizations`, `patient_admissions`, `patients`, `platform_demo_entitlements`, `profiles` — every one of these exists live with matching structure.

**The generic data repository (`src/core/data/repository.js`) — the most important finding of this check.** This module is the app's abstraction for "maybe read from Supabase, maybe read from localStorage," and it declares 23 logical tables. Of those, only **3 are actually configured for cloud storage** (`cloud` is not set to `false`): `training_records`, `environmental_standards`, `control_drafts`. Verified these 3 correctly match the live `training_records`/`environmental_standards`/`control_drafts` tables' columns (`organization_id`, `record_key`, `payload`, etc.) — genuinely, correctly wired end-to-end.

**The other 20 repository tables are still `cloud:false` — localStorage only — despite the live database already having real, purpose-built tables for several of them.** Confirmed by tracing `EmployeesPage.jsx` → `employeeStore.js` → `repository.js`'s `employees` entry (`cloud:false`): the Employees feature never talks to Supabase at all right now, even though `public.employees` exists live with proper columns, RLS, and role-based policies (verified during the earlier backend audit in this session). The same gap applies to `committees` (a rich, governance-capability-driven `public.committees` schema exists live — 8 tables, immutability triggers, secretariat-assignment authority — but the frontend's committee pages still only read/write `localStorage`) and `documents` (the repository key is literally `documents`, while the real live table is named `controlled_documents` — even flipping the `cloud` flag on as-is wouldn't work without also renaming the target table and reshaping the generic `record_key`/`payload` writes into the real, normalized columns each of these tables actually has).

**This is the most consequential open item for backend excellence going forward**: the database is considerably more capable, secure, and complete than what the frontend currently uses. Wiring each of the remaining 20 domains to their real tables is a genuine, non-trivial piece of work per domain (each has its own real column shape, unlike the generic 3 that share one simple `record_key`/`payload` pattern) — recommended as a dedicated follow-up project, domain by domain, with the same rigor applied throughout this session (verify live schema first, write the service layer against it, test before moving to the next domain) rather than attempted as one large, unverifiable batch change.

Full pipeline verified clean for this final delivery: `lint` (0/0), `test` (89/89 across 12 files), `build` clean.
