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
