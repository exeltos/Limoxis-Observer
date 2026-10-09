# Limoxis Observer — Product and Technical Specification

> Hospital infection prevention and control (IPC), surveillance and governance platform.
> Reference implementation: React 18 + React Router 7 + Vite 6, Supabase (Postgres with RLS, SECURITY DEFINER RPCs, Deno edge functions, Storage), deployed as a static SPA on Netlify.
> This document describes **what to build and the rules it must obey**. It is not a copy of the existing code.

---

## How to use this spec with an AI assistant

1. **Feed the whole file** to the assistant in one go. Sections refer to each other (roles, capabilities and modules are used everywhere).
2. **Build in the phase order of §12.** Each phase depends on the previous one: tenancy and authorization first, clinical domains next, governance and analysis last.
3. **Treat §11 (Acceptance criteria) as tests.** Turn each item into an automated test (Vitest, SQL, or Playwright) before calling a phase done.
4. **The database is the security boundary.** Never accept "the button is hidden" as an authorization control (§6).
5. The product is **Greek-first**. Greek UI terms appear in parentheses, e.g. *Surveillance (Επιτήρηση)*. Every visible string must exist in both Greek and English (§7.9).

---

## 1. Purpose and scope

### 1.1 Who uses it

| User group | Typical tasks |
|---|---|
| Platform Owner (vendor) | Creates hospitals (organizations), chooses their package/modules, runs Demo organizations, maintains central libraries and platform settings. |
| Hospital Admin | Sets up one hospital: departments, users and roles, libraries, patient-days, indicators, security settings. |
| Infection Control team (Ομάδα Ελέγχου Λοιμώξεων) | Daily surveillance of patients, prevention audits, controls, indicators, analysis and reporting. |
| Laboratory (Εργαστήριο) | Samples, microbiology results, AST, critical-result communication. |
| Department staff (managers, users, link nurses) | See their department's picture, execute assigned controls, report incidents, do training. |
| Specialist roles | Quality Manager, Committee Secretariat, Pharmacy, Occupational Physician, HR Office, Doctor Reviewer. |

### 1.2 Problems solved

- One environment for the hospital's IPC programme instead of spreadsheets: patients, laboratory, HAI surveillance, prevention, controls, quality/CAPA, training, committees and controlled documents.
- **No double entry**: the Laboratory is the source of truth for microbiology; Surveillance and Indicators consume it by reference. Indicators are computed from source records, never re-typed.
- Role- and department-aware access: each user sees only what their role and departments allow.
- Auditable governance evidence (who/what/when, reasons for voids and corrections) aligned in design with ISO 7101, JCI 8th ed., WHO IPC core components, NHS IPC and Greek regulation (ΕΟΔΥ, ΥΑ Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014). This is a design-traceability goal, not a certification claim.
- National/European reporting: ΕΟΔΥ notifiable-disease findings and EARS-Net isolate export with data-quality checks.

### 1.3 Out of scope

- Not an EHR/HIS: no orders, no medication administration record beyond antimicrobial therapy tracking, no billing.
- Not an autonomous clinical decision maker: the LIRA assistant is decision support and never declares an outbreak on its own.
- No physical deletion of finalized governance evidence in a live organization (voided/archived/superseded instead).
- No native mobile app; the web app is responsive (desktop, tablet, phone).

---

## 2. Tenancy and roles

### 2.1 Tenants

- `organizations` is the tenant root (a hospital or clinic). Optional `parent_id` reserves a future hospital-group hierarchy.
- Organization fields: name, code, type, region/city, bed count, status (`active`, paused, scheduled for deletion), `is_demo`, `operating_profile`, `enabled_modules`, `enabled_addons`, branding (logo for reports), idle-lock minutes.
- `organization_members` joins a user (`auth.users`) to an organization with **exactly one primary role** and a `status` (`active`, `disabled`, plus an `access_hold` reason when the organization is paused/expired). A user may belong to several organizations and switch the active one in the app shell.
- `organization_member_scopes` lists the departments of a membership (department scope). `organization_member_capabilities` holds supplemental grants/add-ons. `work_assignments` holds explicit assignments (e.g. a Doctor Reviewer to a case, a Secretariat to a committee).
- `profiles` holds non-auth user data: display name, `username`, `contact_email`, `is_platform_owner`, `is_demo`.

### 2.2 Platform Owner

- An **identity attribute** (`profiles.is_platform_owner`), never an organization role, custom role, add-on or preview role.
- Full platform access across organizations, enforced only from the authenticated identity (an intentional, audited privileged bypass).
- Works in the Platform Center (`/platform`, `/platform/health`, `/platform/audit`, `/platform/settings`). Lands there when no organization is selected.
- Can enter a Demo organization, preview any role, and edit platform-protected master/reference data. Previewing never grants Platform Owner authority to the previewed session, and Platform Owner authority does not bypass evidence-retention rules.

### 2.3 Roles (system roles are immutable IDs)

| Role ID | Greek label | One-line purpose | Default scope |
|---|---|---|---|
| `hospital_admin` | Διαχειριστής Νοσοκομείου | Full administrator of one organization; **excluded from Occupational Health** and platform capabilities. | Organization |
| `infection_control_lead` | Υπεύθυνος Ελέγχου Λοιμώξεων | Leads the IPC programme: surveillance, prevention, controls, indicators, committees, governance actions. | Organization |
| `infection_control_member` | Μέλος Ελέγχου Λοιμώξεων | Daily surveillance and prevention under the Lead; no lead governance actions. | Organization |
| `link_nurse` | Link Nurse | The department's link to the IPC team; records prevention audits, executes controls. | Department |
| `department_manager` | Προϊστάμενος Τμήματος | Department picture, pending items, controls of the department, staff of the department. | Department |
| `department_user` | Χρήστης Τμήματος | Executes the department's assigned controls with minimum information. | Department |
| `laboratory` | Εργαστήριο | Samples, results, AST, validation, critical communication, resistance classification. | Lab workflow: organization; workforce visibility: department |
| `doctor_reviewer` | Ιατρός Αξιολογητής | Clinical review of surveillance episodes **only when assigned**. | Organization + assignment |
| `occupational_physician` | Ιατρός Εργασίας | Occupational Health (visits, vaccinations, exposures); sees medical data. | Organization (sensitive domain) |
| `hr_office` | Ανθρώπινο Δυναμικό (HR) | Administrative employee registry; **never** medical data. | Organization |
| `quality_manager` | Υπεύθυνος Ποιότητας | Incidents, audits, findings, CAPA, controls, controlled documents lifecycle, indicators. | Organization |
| `committee_secretariat` | Γραμματεία Επιτροπής | Meetings, minutes, decisions **of assigned committees**. | Organization + assignment |
| `pharmacy` | Φαρμακείο | Antimicrobial consumption/dispensing, restricted-antibiotic approvals, therapy. | Organization (pharmacy domain only) |
| `staff_user` | Εργαζόμενος | Own profile, own training/certificates, whatever is assigned. | Self |
| `demo` | Demo | Legacy demonstration role; being replaced by real roles inside Demo organizations (§8.3). Not a production authorization role. | — |

### 2.4 Capabilities

A **capability** is one permitted action (e.g. `create_surveillance`). Roles are sets of capabilities. Every capability in the catalogue carries:

- stable `id`, `domain` (clinical, laboratory, quality, committees, documents, controls, training, workforce, occupational_health, platform, administration, general) and `actionType` (view, manage, create, edit, delete, approve, …);
- Greek and English descriptions;
- `allowedScopes`, `defaultScope`, `maximumScope`;
- `sensitivity`: `standard`, `sensitive` (Occupational Health, clinical review/assessment) or `security` (platform/user/role/org administration);
- `customRoleClass`: `STANDARD`, `RESTRICTED` (sensitive or governance actions) or `SYSTEM_ONLY` (`view_platform`, `manage_platform`, `manage_users`, `manage_roles`, `manage_organization`);
- `addOnEligible` (false for system-only and governance actions), `requiresOwnership`, `requiresAssignment`, `governanceAction`, `rlsMode`.

Capability families to implement (reference IDs):

- **View**: `view_platform`, `view_dashboard`, `view_my_department`, `view_my_profile`, `view_surveillance`, `view_lab`, `view_prevention`, `view_records`, `view_quality`, `view_controls`, `view_training`, `view_committees`, `view_documents`, `view_patients`, `view_staff`, `view_lira`, `view_pharmacy`, `view_occupational_health`, `view_indicators`, `view_analysis`.
- **Manage**: users, organization, platform, controls, quality, documents, staff admin, occupational health, committees, training, pharmacy, indicators, bed days (patient-days), roles, external references, libraries, announcements, hospital structure.
- **Clinical**: create/edit/delete patient, create/edit/delete surveillance, `record_clinical_assessment`, `review_clinical`, `close_surveillance`, `reopen_surveillance`, `reassess_surveillance`, `record_surveillance_outcome`, `manage_isolation`, `manage_antimicrobial_therapy`.
- **Laboratory**: `manage_lab_samples`, `validate_lab_results`, `communicate_critical_results`, `classify_resistance`, `reopen_lab_record`.
- **Prevention**: `record_hand_hygiene`, `record_waste`, `record_antiseptic`, `record_prevention_bundle`, `record_pharmacy`, `record_prevalence_survey`.
- **Governance actions** (explicit; a broad `manage_*` never implies them): document `submit_review`/`approve`/`publish`/`supersede`/`archive`/`delete_draft`; control `execute`/`edit_definition`/`edit_execution`/`void_execution`/`archive_definition`/`delete_draft`; committee `create`/`manage_members`/`create_meeting`/`edit_minutes`/`finalize_minutes`/`manage_decisions`/`manage_documents`/`archive`.
- **Generic record actions**: create, edit, delete, complete, approve, attach files, print, export, assign records (to be narrowed per domain over time).

### 2.5 Data scopes and authorization order

Scopes, ranked: `SELF` < `DEPARTMENT` < `ORGANIZATION` < `PLATFORM`. `OWNER` and `ASSIGNED` are **record relationships** evaluated after scope; `ADD_ON` is a grant, not a scope.

Decision order for every action: **capability → data scope → record relationship → lifecycle → action**.

Invariants:

- `PLATFORM` applies only to platform resources; `ORGANIZATION` never crosses the tenant boundary.
- `DEPARTMENT` is resolved only from stable department IDs on the membership (may be several). A record with **no** `department_id` is **not** visible to a department-scoped role (fail-closed).
- `SELF` requires a stable `auth.users.id → membership → employee_id` link.
- `ASSIGNED` requires an active assignment (cancelled/completed/expired assignments do not count).
- A grant or custom role cannot raise a capability above its `maximumScope`; a department-scoped primary role cannot be escalated to organization scope.
- Edit actions are refused on a **finalized** record regardless of role; non-edit governance actions (void, reopen) follow their own capability.

### 2.6 Add-on capabilities (per user)

Supplemental, additive grants on top of the primary role: `hand_hygiene_observer` (view prevention + record hand hygiene), `waste_management` (view prevention/records + record waste), `committee_member` (view committees), `lira_access` (view LIRA), `lab_access` (view lab), `quality_access` (view quality). Unknown add-on IDs are ignored. System-only and governance capabilities can never come from an add-on.

### 2.7 Custom roles

- Stored in `custom_roles` + `custom_role_capabilities`, per organization, edited in Management › Roles & permissions (Ρόλοι & δικαιώματα).
- The editor offers only `STANDARD` capabilities; `RESTRICTED` and `SYSTEM_ONLY` are never assignable there.
- A membership's primary role is either a system role or one custom role, never a union of several.

### 2.8 Role preview

- Platform Owner (and evaluators inside a Demo organization) can **preview** any previewable role (all system roles except Platform Owner/demo), optionally with a department.
- Preview is presentation-only: navigation, visible datasets and buttons follow the previewed role; every server call uses the real identity. A preview can never authorize a write.
- In a Demo organization a member may switch their own role via an RPC (`demo_switch_my_role`); members never change their own role anywhere else.

### 2.9 Role-specific menu policy

Visibility of a menu item comes from capabilities; **placement** (primary list, "More" group, hidden) and order are decided per role. Example: Department roles land on *My department (Το τμήμα μου)* instead of the Dashboard; Laboratory sees Dashboard, Calendar, Laboratory, Employees, Controls first. Management appears last when any management capability is held.

---

## 3. Packages, modules and add-ons (operating profile)

The Platform Owner sets each organization's **operating profile (Προφίλ λειτουργίας)**. A module that is off is hidden **everywhere** (menu, routes, actions, Analysis tabs, dashboard tiles) by removing its capabilities from every role in that organization. **Data is kept** and returns unchanged when the module is switched on again.

### 3.1 Packages (presets, cumulative)

| Package ID | Greek label | Contents |
|---|---|---|
| `basic` | Βασική καταγραφή | Patients only. |
| `surveillance` | Εργαστήριο & Επιτήρηση λοιμώξεων | + Laboratory, ΕΟΔΥ & EARS-Net reports, Surveillance, Indicators. |
| `full` (default) | Πλήρες πρόγραμμα Ελέγχου Λοιμώξεων | + Prevention, Controls, Quality, Training, Committees & Documents. |

Any combination that matches no preset is stored as `custom`. A package is a shortcut, not a limit: the Owner can lock/unlock individual modules.

### 3.2 Modules

| Module | Purpose | Capabilities switched with it | Analysis tab(s) |
|---|---|---|---|
| `patients` (core, always on) | Patient registry and entry to the clinical record. | — | none (patient details never appear in Analysis) |
| `laboratory` | Samples, cultures, AST, critical results. | view/manage lab, validate, reopen | Microbiology, AMR / MDR-XDR |
| `national` | ΕΟΔΥ notifications, EARS-Net export, data quality. | gated inside Analysis | National surveillance, Reporting & data quality |
| `surveillance` | Episode record: assessment, HAI, therapy, isolation, devices, reassessment, outcome. | all clinical surveillance capabilities | Surveillance & HAI, Antimicrobials |
| `indicators` | Indicator definitions and results. | view/manage indicators, bed days | none (own screen, feeds Overview) |
| `prevention` | Hand hygiene (WHO), bundles, antiseptics, waste. | prevention recording capabilities | Prevention, Hand hygiene |
| `controls` | Scheduled controls per department. | all control capabilities | Controls |
| `quality` | Incidents, audits, findings, CAPA. | view/manage quality, report incident | Quality |
| `training` | Programmes, assessments, certificates, competence. | view/manage training | Training |
| `governance` | Committees and controlled Documents. | all committee and document capabilities | Governance |

### 3.3 Add-ons (outside packages)

| Add-on | Greek label | Capabilities |
|---|---|---|
| `occupational_health` | Υγεία εργαζομένων (Ιατρός Εργασίας) | view/manage occupational health |
| `pharmacy` | Φαρμακείο (κατανάλωση αντιμικροβιακών) | view/manage pharmacy, record pharmacy |
| `prevalence_survey` | Μελέτη επιπολασμού (PPS) | record prevalence survey |
| `lira` | LIRA & AI | view LIRA |

### 3.4 Dependencies (warn, never block)

`surveillance → laboratory`, `indicators → surveillance`, `national → laboratory`. The profile editor shows an orange "Also needs: …" (Χρειάζεται επίσης) warning; saving is allowed. Switching modules **off** asks for confirmation and shows a "Summary of changes".

---

## 4. Functional specification per module

### 4.0 Common building blocks (apply to every module)

- **Registry (Μητρώο)**: `Page` (title, subtitle, actions) → KPI strip of clickable `MetricCard`s that act as quick filters (`aria-pressed`) → `FilterBar` (search + frequent filters visible + advanced filters behind one control with an active-count badge and Clear) → `RegistryTable` with clickable rows → `RegistryPagination` (15/25/50 rows, "1–15 of 120"). Filters and the last opened row are remembered when returning; the returned row is highlighted.
- **Record (Καρτέλα)**: `EntityRecordShell` with avatar/icon, eyebrow = record code, title, subtitle, status badges, previous/next record navigation within the filtered list, header actions (edit, delete draft, Print, Export), and tabs. Typical tabs: Summary/Details, domain tabs, Documents/Attachments, History.
- **Create flow**: a dedicated `/…/new` page or an `ObserverDialog`, with required-field validation, unsaved-changes guard and a success notification.
- **Lifecycle helpers**: finalize, open correction (with reason), void (with reason) — each appends a history event `{at, actor, actorId, action, reason}`.
- **Attachments**: one shared attachment field/panel (upload progress, delete behind confirmation), stored in Storage buckets per organization.
- **Exports**: CSV for registries, PDF reports (branded with the hospital logo), structured JSON record export as the generic fallback. Print/Export are icon-only.

### 4.1 Dashboard (Πίνακας) and My department (Το τμήμα μου)

- Dashboard shows only what needs attention and what the user may know: pending/overdue items per module, alerts (e.g. cluster signals), first-steps card for new organizations.
- Department roles land on *My department*: their department's patients under surveillance, controls due, training, pending items.
- Login briefing dialog and a Notification Center summarise new items; announcements from Management can target all, a role, a department or a user and may require acknowledgement.

### 4.2 Patients (Ασθενείς)

- Registry with search; **search before create** to prevent duplicates. Fields: patient code (unique per organization), name, sex, date of birth (birth weight for infants), department, admission/discharge dates, status (`active`, `discharged`, `deceased`, `transferred`).
- Admissions (`patient_admissions`) group episodes; the patient record opens per admission with tabs: Summary, Surveillance & samples (journey), Clinical data, Clinical assessments (clinical scales: Braden, GCS, Morse, NEWS2, SOFA), Documents, History.
- Infection/risk flags (e.g. MDRO carrier, isolation active) shown as compact badges.
- Department-scoped roles see only patients of their departments.

### 4.3 Surveillance (Επιτήρηση)

**Not a linear wizard.** Patient → surveillance episode → parallel evidence → outcome → authorized closure.

- **Episode (`surveillance_cases`)**: patient, admission, department, status `active` → `closed` (with close reason) or `cancelled`; `started_at`, `closed_at`. Reopen requires `reopen_surveillance`.
- Parallel, independently evolving evidence inside the episode:
  - **Clinical assessment** (`clinical_assessments`): type `suspected`, `healthcare_associated`, `community_associated`, `other`.
  - **HAI classification** (`hai_classifications`): case status `suspected`, `probable`, `confirmed`, `excluded`, `undetermined`; HAI type (CLABSI, CAUTI, VAP, SSI, pneumonia, …) with an NHSN-inspired criteria checklist (decision support; free-text rationale always available). Criteria sets are governed library items (`master_library_items`, key `hai_criteria`) editable/versioned by the Platform Owner; neonatal variants exist.
  - **Samples/microbiology/AST**: read-only references to Laboratory records (never duplicated).
  - **MDR/XDR/PDR**: derived from validated AST, displayed as a badge; never a workflow step; may change when new results arrive.
  - **Antimicrobial therapy** (`antimicrobial_therapies`): status `planned`, `active`, `completed`, `stopped`, `cancelled`; approval status `not_required`, `pending`, `approved`, `rejected` (restricted antibiotics); source `patient_record` or `laboratory` (linked result/sample). Administrations (`antimicrobial_therapy_administrations`): `administered`, `withheld`, `refused`. Therapy may start empirically before AST.
  - **Isolation episodes** (`isolation_episodes`): precaution type, start, review-due date, end, responsible actors; status `active`, `ended`, `cancelled`. May start before a culture result. Overdue reviews surface on the Dashboard.
  - **Devices** (`surveillance_devices`): central line, urinary catheter, ventilator…, inserted/removed dates, status `active`, `removed`, `unknown`; validation `draft`, `validated`, `amended`. Device-days are the denominator of device-associated rates.
  - **Reassessments** (`surveillance_reassessments`, append-oriented): clinical status `improved`, `stable`, `deteriorated`, `resolved`, `undetermined`; therapy decision and isolation decision (`continue`, `modify`, `stop/discontinue`, `not_applicable`).
  - **Outcome** (`surveillance_outcomes`): `ongoing`, `discharged`, `transferred`, `deceased`, `resolved`, `other`; recorded separately from closure.
  - **Timeline** (`surveillance_events`): typed events with status `pending`, `in_progress`, `completed`, `cancelled`, `overdue`.
- **Employee surveillance** (screening of staff, e.g. after exposure or for MDRO): `employee_surveillance_records` with result `pending/negative/positive/inconclusive` and intervention status; visible only to roles allowed to see sensitive employee health.
- **Environmental surveillance**: environmental samples against `environmental_standards` (governed limits/protocols).
- **Cluster detection**: tightest run of ≥3 same-organism, same-department positive isolates within a 14-day window anywhere in retained history; raises an alert with a stable ID; feeds LIRA outbreak investigations.
- **Neonatal**: NICU CLABSI rates are stratified by NHSN birth-weight band; infants with a central line and no birth weight are counted and reported separately (never silently dropped).

### 4.4 Laboratory (Εργαστήριο)

- Registry/workspace with a **pending queue** and filters by status, type, department, critical, MDRO. Subjects may be a patient, an employee or an environmental site (subject choice step).
- **Sample lifecycle (`laboratory_samples`)**: `requested` → `collected` → `received` → `processing` → `completed`; also `rejected`, `cancelled`. Fields: sample code (unique per org), type, source site, priority (`routine`, `urgent`, `critical`), requested/collected/received times, department, patient, optional surveillance case, `parent_sample_id` (sub-samples). Turnaround hours computed.
- **Result (`microbiology_results`)**: result status `positive`, `negative`, `inconclusive`, `contaminated`; organism(s) (polymicrobial allowed); identification method (culture, MALDI-TOF, PCR, microscopy, other); validation `draft` → `validated` → `amended` (an amendment supersedes, the chain keeps the original key).
- **AST (`antimicrobial_susceptibility_results`)**: per antimicrobial: method, MIC (with operator) or zone, `S`/`I`/`R`, breakpoint standard and version. EUCAST semantics: **I is "susceptible, increased exposure" and must never be grouped with R**. Finalized AST rows are immutable (DB trigger guard).
- **AMR classification (`amr_classifications`)**: MDR/XDR/PDR stored separately with definition source/version, calculation evidence and status `proposed`, `reviewed`, `confirmed`, `overridden`, so later definition changes never rewrite history.
- **Critical result communication (`critical_result_communications`)**: append-only; who communicated, when, to whom, recipient role, method (`phone`, `in_person`, `secure_message`, `other`). A critical result cannot be saved as communicated without a timestamp (DB check).
- Record tabs: Sample, Microbiology result, Attachments, History. Linking a sample to a patient/episode needs no second entry.

### 4.5 Prevention (Πρόληψη)

Tabs: Hand hygiene, Waste management, Antiseptic consumption, Prevention bundles, (Staff) Vaccinations. Record route `/prevention/:recordType/:recordId`.

- **WHO hand hygiene** (`hand_hygiene_sessions` + `hand_hygiene_observations`): session (department, observer, date, duration, status `draft/completed/cancelled`); each opportunity: professional category, count, WHO moment 1–5, action `HR` (hand rub), `HW` (hand wash) or `MISSED`, gloves. Compliance = (HR+HW)/opportunities; WHO target ≥ 80%.
- **Waste** (`waste_measurements`): monthly quantity per department and waste category from the shared waste-category library.
- **Antiseptics** (`antiseptic_consumption_periods`): monthly consumption per department/product from the antiseptic library (e.g. alcohol hand rub litres per 1,000 patient-days).
- **Bundles** (`prevention_bundle_templates` draft/published/retired; `prevention_bundle_assessments` draft/completed/cancelled): CLABSI, CAUTI, VAP/VAE, SSI; each element Yes/No/N/A; compliance is all-or-nothing per assessment. A failed criterion becomes a **deviation** in the Quality deviation queue; follow-up dialog for re-assessment.
- **Staff vaccinations**: seasonal influenza coverage feeds the ΥΑ 388/2014 staff vaccination indicator.

### 4.6 Controls (Έλεγχοι)

Views: Programme (registry), Calendar, Adherence.

- **Definition (`control_definitions`)**: code, title (EL/EN), category, owner, `frequency_config` (daily/weekly/monthly/…), `response_config` (structured questions/questionnaire, **criticality** high/medium/low, **requires evidence**, deviation instructions); status `draft`, `active`, `inactive`, `archived`. Temporary drafts (`control_drafts`) are kept per user.
- **Assignment (`control_assignments`)**: control × department (optional assignee), `last_completed_at`, `next_due_at`, status `scheduled`, `due`, `overdue`, `paused`.
- **Execution (`control_executions`)**: result per item, findings, evidence attachment (mandatory when `requiresEvidence`), status `completed` or `cancelled`; edits create `control_execution_revisions`; **void** requires a reason and `void_control_execution`.
- **Scheduling rule**: next due = completion + interval (the schedule restarts from each completion). Registry order: overdue first, then due soon; within each, high criticality first.
- **Adherence**: per control × department over 30d / 90d / 12m / year: expected occurrences (nominal from frequency), recorded, on time (with grace: a couple of hours for daily, one day for longer cycles), missed; tone ≥90% good, ≥75% fair, else low.
- An execution with a finding appears in the Quality deviation queue until a CAPA points to it.
- Department Managers may edit definitions and void executions within their departments; Department Users execute only.

### 4.7 Quality (Ποιότητα)

Record types: `incidents`, `audits`, `findings`, `capas`, plus the **Deviations** queue. Routes `/quality/:recordType/new` and `/quality/:recordType/:recordId`.

- **Incident (`quality_incidents`)**: code, title, department, occurred at, severity `low/medium/high/critical`, harm, status `reported` → `under_review` → `closed`. Any employee with `report_incident` can report.
- **Audit (`quality_audits`)**: `internal`/`external`, status `planned` → `in_progress` → `completed` (or `cancelled`).
- **Finding (`quality_findings`)**: source `manual/incident/audit/control/other`, status `open` → `in_progress` → `closed`.
- **CAPA (`quality_capa_actions`)**: code, type `corrective`/`preventive`, source type + source ID, priority, owner, due date, status `open` → `in_progress` → `verification` → `closed`; effectiveness due date and status `pending/effective/not_effective`, verified by/at. Tabs: Details, Steps (sub-actions with progress `done/total` and overdue sub-actions), Root causes (problem statement, **5 Whys**, **Ishikawa** fishbone with healthcare categories, conclusion), Linked records (`quality_record_links`), Documents, History.
- **Deviation queue**: control executions with a finding and failed bundle criteria from the last 90 days with no CAPA yet; the Quality Manager converts each into a prefilled CAPA (recording staff cannot create CAPAs under quality RLS).
- CAPAs can also originate from training effectiveness failures (source ID `TRAINING:<programme id>`) and LIRA outbreak investigations.

### 4.8 Employees (Προσωπικό) and My profile

- Registry with import from spreadsheet (column mapping, validation preview). Fields: name, employee code, profession/category, position, department, employment status `active/inactive/leave`, contact, link to a user account.
- Record tabs (shown by permission): Details, Position (job description + acknowledgements), Occupational health (only Occupational Physician or self), Surveillance (sensitive), Training, Evaluations (`employee_evaluations`), Documents/Certificates, Protocols (published documents to acknowledge), History (`audit_employee_change`).
- HR edits administrative data only; Laboratory and department roles see employees of their departments only; `/my-profile` is the self-scoped view.

### 4.9 Occupational Health (Υγεία εργαζομένων) — add-on, sensitive

- Sections: Visits, Exposure incidents; vaccinations on the employee record.
- **Visit (`occupational_health_visits`)**: date, type, status `scheduled/completed/cancelled`, fitness `fit`, `fit_with_restrictions`, `unfit`, `pending`, follow-up date, clinical notes. Created from the Occupational Health registry ("New visit"): a scheduled visit has fitness `pending` and no follow-up; a completed visit requires a fitness outcome. "Fit for work" counts employees by their latest completed visit, not visits.
- **Vaccination (`employee_vaccinations`)**: vaccine (library item + label snapshot), dose, date, lot, valid until, status `complete`, `renew_soon`, `overdue`, `declined`, `contraindicated`.
- **Exposure incident (`occupational_exposure_incidents`)**: type `needlestick`, `sharps_object`, `mucocutaneous`, `non_intact_skin`, `other`; department type (general/ICU/NICU/PICU); source-patient status (unknown/negative/HBV+/HCV+/HIV+/other); follow-up status `pending/scheduled/completed/closed`; status `open/closed`. The employee can read their own exposure records.
- Medical data is visible only to the Occupational Physician (and Platform Owner; and Hospital Admin **only inside Demo organizations**, where all people are synthetic). HR and Hospital Admin never see it in a real hospital. Analysis shows aggregates only.

### 4.10 Pharmacy (Φαρμακείο) — add-on

- Restricted-antibiotic approvals queue (therapies with `approval_status = pending`), consumption/dispensing.
- **Dispensing periods (`antibiotic_dispensing_periods`)**: department, period start/end (monthly), antibiotic library item, quantity in grams, source, reference, responsible.
- **DDD**: consumption in DDD per 100 patient-days (ΥΑ 388/2014 indicator) using `who_ddd_reference`; the UI warns that DDD values must be verified against the current WHO ATC/DDD Index before national reporting.
- **WHO AWaRe** (Access/Watch/Reserve, WHO 2021) classification by antibiotic name, used in Analysis and indicators.

### 4.11 Indicators (Δείκτες)

- **Definition (`indicator_definitions`)**: key, titles EL/EN, numerator/denominator definitions, unit, direction `higher/lower/context`, source authority, version, effective from/to, status `draft` → `review` → `active` → `retired`. Library includes ΕΟΔΥ reference indicators: bacteraemia/resistance for the 8 reference pathogens, device-associated rates (CLABSI/CAUTI/VAP per 1,000 device-days), MDRO isolation, antibiotic DDD, AWaRe share, staff influenza vaccination, PPS prevalence.
- **Result/snapshot (`indicator_snapshots`)**: period, department or hospital, numerator, denominator, value, `calculation_type` auto/manual, `source_snapshot` (jsonb provenance), status `draft` → `calculated` → `reviewed` → `approved` (→ `retired`). Results can be sent to a committee.
- **Denominators**: `calculated_patient_days` (view from admissions), `patient_days` (manual/imported overrides, source + review status), `effective_patient_days` (view resolving the effective denominator with provenance), `patient_day_periods` per department/period. Patient-days are period denominators, never inferred from surveillance patients.
- Indicators consume source records directly; users never re-enter numerator data.

### 4.12 Training (Εκπαίδευση)

Views (managers): Programmes, Annual plan, Retraining, Competence. Programme record tabs: Overview, Participants, Material, Assessment, Results, Effectiveness.

- **Programme**: title, category, method, trainer, dates, departments/participants, status.
- **Assignment**: participant invited (e-mail with a single-use token link `/training-access/:token` usable without sign-in), completion, score.
- **Assessment**: question types single choice, multiple choice, true/false (scored, points) and free text (manual review); max score computed; validation of each question.
- **Certificate**: generated PDF (hospital branding, participant, programme, issue date, valid until) stored in `employee_certificates`.
- **Effectiveness** (3 levels): feedback, learning (assessment), practice change evaluated months later (observation/audit/indicator) with result effective/partial/not effective; not effective → prefilled CAPA.
- **Competence**: requirements per profession/position/department with renewal months; matrix of employees × requirements; retraining plan (missing, expired, expiring) feeding the annual plan and calendar.
- Employees see only their own training.

### 4.13 Committees (Επιτροπές)

Record tabs: Overview, Members, Annual plan, Meetings, Decisions, Framework (legal basis), Documents, History.

- **Committee (`committees`)**: code, name, type (an IPC committee catalogue exists), mandate, legal basis, decision number, term start/end, meeting frequency, quorum rule; status `draft/active/inactive/archived`.
- **Members (`committee_members`)**: type `regular/alternate/observer/advisor`, membership approval status; members may be internal accounts or external people. Membership grants `committee_member` add-on visibility.
- **Meeting (`committee_meetings`)**: title, scheduled at, agenda, minutes, minutes number, quorum met, attendance (`present/absent/excused/not_recorded`); status `draft` → `planned` → `in_progress` → `approval_pending` → `finalized`, or `cancelled` (reason required, via RPC). Monthly meetings are named after their month.
- **Minutes approval**: each member approves or rejects (`committee_minutes_approvals`: pending/approved/rejected/cancelled; history kept). Members without an account receive a personal single-use e-mail link `/minutes-approval/:token` (approve / request changes) or approval is recorded on paper (`committee_minutes_external_approvals`). A rejection opens a revision cycle; finalization requires `finalize_committee_minutes`.
- **Decisions (`committee_decisions`)** and **plan items** with owner, due date and status `open/in_progress/completed/cancelled`; committee documents by kind (establishment, agenda, minutes, decision, evidence, other).
- Secretariat acts only on assigned committees.

### 4.14 Documents (Έγγραφα) — controlled documents

- **Lifecycle (`controlled_documents`)**: `draft` → `review` → `approved` → `published` → `superseded` or `archived`. Edit and delete only in `draft` (delete needs `delete_document_draft`). Each transition needs its own capability (submit review, approve, publish, supersede, archive).
- Fields: code, title, document type, department, audience (`organization/department/restricted`), version (revisions increment, e.g. 1.0 → 1.1/2.0), owner, effective date, **review date** (due-for-review surfaces in Calendar/Analysis), `revision_of_id`/`supersedes_id` forming a version family; publishing a new version supersedes the previous one.
- Approvals (`document_approvals`): pending/approved/rejected/cancelled.
- Record tabs: Overview, Files, Distribution (Κοινοποίηση: send to roles/departments/users, notifications), History. An acknowledgements page lists who read/acknowledged each distributed document. Exports: PDF + JSON.

### 4.15 Calendar (Ημερολόγιο)

Aggregates every dated item someone has to act on into one event list `{id, date, time, kind, title, detail, department, path, state}` with state `overdue`, `due` or `planned`. Kinds: controls (daily listed once at next due; weekly+ projected across the range), CAPA, audits, training (including effectiveness evaluations and retraining), documents (review dates), committees (meetings). Month grid with Monday-first weeks; each event deep-links to its record. Only kinds the user can view appear.

### 4.16 Analysis (Ανάλυση)

- Period picker: year + year/half/quarter/month, optional comparison year and department.
- Tabs (shown only if their module is on and the role may view them): Overview, National surveillance, Surveillance & HAI, Microbiology, AMR / MDR-XDR, Antimicrobials, Prevention, Hand hygiene, Controls, Employees (occupational, aggregate only), Quality, Training, Governance, Prevalence survey (PPS), LIRA & AI. Tabs are grouped into sections; a section with one visible tab shows no sub-tabs.
- Each tab = KPI tiles (rates, not raw counts where possible) + charts + breakdown tables, computed server-side by an RPC (e.g. `analysis_domain_metrics`) in production; in demo the same shape is computed from fixtures.
- Department scope is honest: when a metric cannot be scoped to a department it shows "—", not a hospital number.
- Print and PDF export per tab.

### 4.17 National reporting (ΕΟΔΥ / EARS-Net) — "Reporting & data quality"

- **Data quality checks** over samples and patients (missing patient link, birth date, department, collection time, AST without breakpoint version, …) with severity high/medium/low; fix gaps before submission.
- **ΕΟΔΥ notifiable findings**: rules map validated positive patient results (organism, specimen, resistance, e.g. carbapenem-resistant Gram-negative bacteraemia) to diseases in the notifiable-diseases library; most specific rule wins; amendments keep the original notification key. `notifiable_disease_reports` status `pending/notified/not_required`.
- **EARS-Net export**: invasive isolates (blood, CSF) of the 8 EARS-Net pathogens; first isolate per patient, pathogen and year; one row per antimicrobial test in TESSy layout; WHONET antimicrobial codes; patient pseudonymised with a salted non-reversible hash (no code or name); age, sex, inpatient/unknown; unmapped tests listed separately; CSV download.

### 4.18 LIRA assistant (add-on "LIRA & AI")

- A launcher available across the app; answers questions on HAI metrics, AMR, antibiograms, stewardship, operational overview, using **only data the user is already entitled to see**.
- **Deterministic first**: built-in rules and calculations answer without any AI provider; when a provider is configured, the edge function `lira-ai-gateway` sends the question + deterministic answer (authoritative, never recalculated) + approved knowledge chunks (RAG) + optional aggregate/patient context (each gated by organization settings `allow_aggregate_data`, `allow_patient_level_data`) and returns the answer with citations and a safety block.
- Provider settings (`lira_ai_provider_settings`) are set by Hospital Admin; the API key is never sent to the browser (read server-side via a SECURITY DEFINER RPC).
- Knowledge base: `lira_knowledge_sources` (draft → review → approved → retired), revisions and text chunks; only approved knowledge is cited.
- **Outbreak investigations** (`lira_outbreak_investigations` draft/active/closed; events: snapshot, hypothesis, decision, status, case review; human case reviews): case definition, line list, reasoning, closure checklist, report, CAPA link. Never declares an outbreak autonomously; human review required.

### 4.19 Management Center (Κέντρο Διαχείρισης)

Groups: **Access** (Users, Roles & permissions, Security — idle lock minutes, Identity/branding, Announcements), **Libraries** (departments, microorganisms, antibiotics, waste categories, antiseptics, vaccines, notifiable diseases, questionnaires, clinical scales, environmental templates, bundles, HAI criteria, external references), **Data** (Indicators, Patient-days, Structural indicators/hospital structure snapshots, Prevalence survey PPS), **LIRA** (AI provider, knowledge, outbreak investigations).

- Libraries are a governed master-data centre (`master_library_items`): core/system items are not deleted, only hidden or overridden per organization; platform-protected items are editable only by the Platform Owner.
- External references (`external_reference_versions`): official sources are versioned; update detection is separate from activation; status `pending_review` → `approved` / `rejected` / `superseded`. Clinical content sources can be refreshed by an edge function (`refresh-clinical-source`).
- User access dialog: invite, resend invitation, reset password, disable, change role/departments/add-ons (edge functions `create-organization-user`, `manage-organization-user`).

### 4.20 Platform Center (Platform Owner)

- Dashboard (attention items), Organizations registry and record (identity, operating profile, Hospital Admin invitation/resend, diagnostics, offboarding), Demos registry and record (lifecycle, evaluators, evaluation progress), Global management (central libraries, HAI criteria, indicators, LIRA knowledge, external references), Health (runtime events), Audit & security, Settings (default demo duration, max demo users, auto-purge days, maintenance banner, login notice).
- Organization lifecycle: active ⇄ paused → scheduled for deletion (grace period, default 30 days; requires an export from the last 30 days or a recorded waiver reason) → purge; cancellable until the date. Export = ZIP of every organization table as CSV (UTF-8, `;`), the organization row as JSON and all attachments, in a private bucket with short-lived links.
- Deletion has **one path**: edge function `platform-delete-organizations` (re-checks the Owner's password, rate-limited, multi-delete requires typing "ΔΙΑΓΡΑΦΗ <count>"/"DELETE <count>"), single-use purge ticket, transactional purge RPC, storage cleanup, account cleanup, audit.

---

## 5. Data model

### 5.1 Conventions (mandatory for every tenant table)

- `id uuid primary key default gen_random_uuid()`.
- `organization_id uuid not null references organizations(id)` on **every** tenant row (never inferred from client state). Child rows repeat it.
- `department_id` wherever a record belongs to a department; required for department-scoped visibility (missing department = invisible to department roles).
- `created_by`, `updated_by` (→ `auth.users`), `created_at`, `updated_at`, set by a trigger (`set_repository_audit_fields`), not trusted from the client.
- Human-readable `code` unique per organization (e.g. sample code, CAPA code).
- Status columns are `text` with `check (status in (...))` constraints; status values are stable English keys translated in the UI.
- **Soft lifecycle**: `voided_at/voided_by/void_reason`, `correction_reason`, `finalized_at/finalized_by`, `archived` status. Finalized evidence is never physically deleted in a live organization; draft deletion is a separate capability.
- **Versioning**: documents (`version`, `revision_of_id`, `supersedes_id`), indicator definitions (version + effective dates), library/reference versions, AMR classification definition version, AST breakpoint standard/version, clinical scale definitions (draft/approved/retired), control execution revisions.
- **History/audit tables**: `system_audit_log` (append-oriented, organization-aware), `clinical_audit_log` (INSERT/UPDATE/DELETE with metadata references, not full clinical payloads), `committee_history`, `committee_minutes_approval_history`, `control_execution_revisions`, `clinical_content_source_history`, employee/management change audit triggers.
- Foreign keys indexed; child tables `on delete cascade` from the organization except where `restrict` protects clinical integrity (purge deletes in explicit order).

### 5.2 Tables by domain

| Domain | Tables | Notes |
|---|---|---|
| Identity & tenancy | `profiles`, `organizations`, `organization_members`, `organization_member_scopes`, `organization_member_capabilities`, `account_invitations`, `departments`, `work_assignments` | Membership = one role; scopes = department IDs; assignments = explicit record relationships. |
| Authorization catalogue | `roles`, `capabilities`, `role_capabilities`, `custom_roles`, `custom_role_capabilities` | Must stay aligned with the frontend matrix (audited in CI). |
| Patients | `patients`, `patient_admissions`, `patient_days`, `patient_day_periods`, views `calculated_patient_days`, `effective_patient_days` | Patient code unique per org. |
| Clinical surveillance | `surveillance_cases`, `surveillance_events`, `clinical_assessments`, `hai_classifications`, `surveillance_devices`, `isolation_episodes`, `surveillance_reassessments`, `surveillance_outcomes`, `antimicrobial_therapies`, `antimicrobial_therapy_administrations` | Case → patient; evidence → case. |
| Clinical scales | `clinical_scale_definitions`, `clinical_scale_org_settings`, `patient_clinical_scale_assessments` | Assessment status draft/final/amended. |
| Laboratory | `laboratory_samples`, `microbiology_results`, `antimicrobial_susceptibility_results`, `amr_classifications`, `critical_result_communications`, `notifiable_disease_reports` | Sample → patient/case; result → sample; AST → result. |
| Employees & occupational health | `employees`, `employee_evaluations`, `employee_position_acknowledgements`, `employee_certificates`, `employee_training_summary`, `employee_vaccinations`, `occupational_health_visits`, `occupational_exposure_incidents`, `employee_surveillance_batches`, `employee_surveillance_records` | Medical tables have separate RLS from administrative ones. |
| Prevention | `hand_hygiene_sessions`, `hand_hygiene_observations`, `waste_measurements`, `antiseptic_consumption_periods`, `prevention_bundle_templates`, `prevention_bundle_assessments`, `point_prevalence_surveys`, `environmental_standards` | Monthly periods for waste/antiseptics. |
| Pharmacy | `antibiotic_dispensing_periods`, `who_ddd_reference` | DDD reference values. |
| Controls | `control_definitions`, `control_assignments`, `control_executions`, `control_execution_revisions`, `control_drafts` | Assignment = control × department. |
| Quality | `quality_incidents`, `quality_audits`, `quality_findings`, `quality_capa_actions`, `quality_record_links` | CAPA `source_type` + `source_id`. |
| Committees | `committees`, `committee_members`, `committee_meetings`, `committee_meeting_attendance`, `committee_minutes_approvals`, `committee_minutes_approval_history`, `committee_minutes_external_approvals`, `committee_decisions`, `committee_plan_items`, `committee_documents`, `committee_history` | External approvals carry a single-use token. |
| Documents | `controlled_documents`, `document_approvals` | Version family via `revision_of_id`/`supersedes_id`. |
| Training | `training_records` (typed payload rows: programmes, assignments, requirements, …), `employee_certificates` | Token access for e-mailed participants. |
| Indicators | `indicator_definitions`, `indicator_snapshots`, `hospital_structure_snapshots` | Snapshot keeps `source_snapshot` provenance. |
| Libraries & references | `master_library_items`, `external_reference_versions`, `clinical_content_sources`, `clinical_content_source_history` | Global vs organization override separation. |
| Communication | `management_announcements`, `management_announcement_acknowledgements`, `notification_outbox`, `user_screen_guides` | Outbox status pending/processing/sent/failed/cancelled. |
| LIRA | `lira_ai_provider_settings`, `lira_knowledge_sources`, `lira_knowledge_source_revisions`, `lira_knowledge_chunks`, `lira_outbreak_investigations`, `lira_outbreak_investigation_events`, `lira_outbreak_case_reviews` | Provider secret readable only server-side. |
| Attachments | `attachments` + Storage buckets `attachments`, `laboratory-attachments`, `organization-exports` | Paths prefixed by organization ID. |
| Platform & demo | `platform_settings`, `platform_demo_entitlements`, `demo_entitlements`, `demo_evaluation_progress`, `demo_application_requests`, `platform_organization_exports`, `platform_purge_tickets`, `platform_reauth_failures`, `platform_runtime_events` | Owner-only except self-read RPCs. |
| Audit | `system_audit_log`, `clinical_audit_log` | Append-oriented. |

---

## 6. Security

### 6.1 Principles

1. **RLS is the authority.** Every table has RLS enabled and explicit policies before it is considered complete. UI hiding is usability only.
2. **Tenant isolation**: a user reads/writes rows only where `organization_id` is an organization of an **active** membership (or the user is Platform Owner).
3. **Department scope**: department-scoped roles read rows only where `department_id` is in their membership scopes; `null` department → denied (fail-closed).
4. **Capability-specific policies**: helpers such as `current_user_has_capability(org, cap)`, `current_user_has_org_role(org, roles[])`, `current_user_has_department_scope(org, dept)`, `current_user_has_governance_capability`, `current_user_is_platform_owner()`, `can_view_surveillance_record(...)`, domain read/write helpers per prevention stream. Laboratory workflow visibility is organization-wide while laboratory workforce visibility is department-scoped — model them separately.
5. **Organization state gates access in the database**: every membership helper requires `status = 'active'`; pausing an organization, scheduling deletion, or a Demo expiring/pausing puts members on hold (`status='disabled'`, `access_hold`), and lifting it re-enables only held memberships. Platform Owner is never held.
6. **Sensitive domains**: Occupational Health and employee clinical surveillance require both the capability and an allowed role family; workforce (HR) RLS is separate from Occupational Health RLS.
7. **Write separation**: laboratory writes laboratory data; pharmacy writes therapy/consumption; IPC roles manage IPC clinical actions; recording staff cannot create CAPAs.
8. **Least-privilege notifications**: notification content never exposes data the recipient cannot read.

### 6.2 SECURITY DEFINER rules

- Every SECURITY DEFINER function exposed to `anon`/`authenticated` via `/rest/v1/rpc` is declared in a manifest (`security-definer-manifest.json`) with a category and reason:
  - **rls-helper**: answers only what the caller may do; executable by `authenticated`.
  - **rpc**: performs an action or returns data; must check the caller itself (`auth.uid()` or a helper).
  - **public-token**: callable by `anon`, guarded by a random single-use token (training links, minutes approval) or exposing no organization data (login notice).
- Trigger functions are executable by nobody. `search_path` is pinned. Revokes live in migrations so a rebuilt database matches production.
- A CI audit replays migrations and fails on an undeclared exposed function, exposure mismatch, an `rpc` without caller check, `anon` reaching non-`public-token` functions, or a callable trigger function.
- Multi-step platform operations are single transactional RPCs (create demo, convert demo, schedule deletion, purge) — never multiple browser calls.

### 6.3 Edge functions and CORS

| Function | Purpose |
|---|---|
| `username-login` | Username → contact email lookup (service role), password sign-in, returns tokens; generic "Invalid credentials" and constant minimum response time (~300 ms) to prevent enumeration. |
| `request-account-recovery` | Always answers OK after a constant delay; sends a reset link only if the e-mail belongs to a profile. |
| `accept-account-invitation` | Activates only the account owning a pending invitation; refuses if the organization is paused or the Demo is expired/paused; never changes another signed-in user's password. |
| `create-organization-user`, `manage-organization-user` | Invite/resend/reset/disable users; Demo admins add evaluators up to `max_demo_users`; failed invites never leave the admin without an account. |
| `platform-create-hospital`, `create-demo-access` | Owner-only creation; Demo invitations leave only after the data pack is in. |
| `platform-delete-organizations`, `platform-export-organization`, `platform-housekeeping`, `platform-scheduled-tasks` | Offboarding, export, auto-purge of long-expired Demos, nightly reminder dispatch (called by `pg_cron` with a Vault secret, never by a browser). |
| `process-notification-outbox` | Sends queued e-mails; a Demo never e-mails synthetic people (`@*.invalid`). |
| `lira-ai-gateway`, `lira-provider-settings`, `refresh-clinical-source` | LIRA provider calls, provider config, external source refresh. |

- Every function validates the caller's JWT and membership itself; service-role clients are used only server-side.
- **CORS allowlist**: production domains, the Netlify site, `https://<name>--<site>.netlify.app` deploy previews (regex), and `localhost:5173`/`127.0.0.1:5173`. A non-allowed origin receives the primary domain in `Access-Control-Allow-Origin` (the browser refuses). `Vary: Origin` always. Calls without Origin (cron) unaffected.

### 6.4 HTTP headers (static host)

- CSP: `default-src 'self'; script-src 'self'` (no inline scripts — printable windows must not rely on them); `style-src 'self' 'unsafe-inline'`; `img-src`/`connect-src` only self + the Supabase project (https + wss); `frame-src`/`frame-ancestors` self + own domains (Help Center embeds the app in itself); `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `upgrade-insecure-requests`.
- HSTS 1 year incl. subdomains, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying camera/microphone/geolocation/payment/usb.
- `/assets/*` immutable 1-year cache (hashed filenames); `/manual/*` `noindex, nofollow`. SPA fallback redirect `/* → /index.html 200`.

### 6.5 Auth flows

- **Invitation activation** (`/activate`): user follows e-mail link, sets own password (nobody else ever sees it), then signs in with the shown username.
- **Login** (`/login`): username or e-mail + password; login-screen notice (public).
- **Forgot access** (`/forgot-access`) → recovery e-mail → **reset password** (`/reset-password`).
- Admin-initiated: resend invitation, reset password (Hospital Admin for users; Platform Owner for the Hospital Admin).
- **Idle lock**: after the organization's idle minutes the screen locks (app stays mounted, nothing typed is lost); the same user unlocks with their password, anyone else signs in as themselves; a reload does not skip it; a device that slept past the limit locks on wake; nothing behind the lock is keyboard/screen-reader reachable.
- Session selection (organization, demo mode, role preview) persists per tab in `sessionStorage` and is cleared on sign-out.

### 6.6 Audit trail and data protection

- Audit role/grant/scope/add-on/assignment changes with actor, target, organization, before/after, timestamp and reason; audit privileged Platform Owner mutations and protected-data access with the real actor.
- Clinical audit stores metadata references, not full clinical payloads.
- Exports for national reporting are pseudonymised; patient data never appears in Analysis; occupational data only aggregated outside the Occupational Physician's screens.
- Attachments are organization-prefixed and covered by storage policies; purge removes storage objects.

### 6.7 RLS isolation test approach

A single SQL script (runnable against any copy, even production) does everything inside one `DO` block that **always ends by raising an exception**, so all test data rolls back:

1. Create two organizations (A, B), departments A1, A2, B1, users: admin A, IPC lead A, department user A1 (scoped to A1), admin B, and a user with no membership.
2. Insert patients, surveillance cases, lab samples and quality incidents in A1, A2, B1 (impersonating a member so audit triggers pass).
3. For each user: set JWT claims, `set local role authenticated`, count rows of the test organizations across `patients`, `surveillance_cases`, `laboratory_samples`, `quality_incidents`, `departments`. Fail if any foreign-organization rows are visible, or if the department user sees another department's rows. Positive control: each admin sees their own patients.
4. As `anon`: zero rows (or insufficient privilege).
5. Raise `RLS_PASS {checks}` or `RLS_FAIL {failed}`; CI greps the message. Runs only when a DB URL secret exists.

---

## 7. UI and UX rules (Observer UI contract)

### 7.1 Layout

- App shell: sidebar navigation (role menu policy, "More" group, Management last), top bar (organization switcher, language, notifications, help, account), content area. Page shell and tab bar stay fixed; lists/tables own the scroll.
- Desktop > 1100 px full sidebar; tablet 641–1100 px icon rail with a menu button that opens the full labelled menu as an overlay (closes on navigation, backdrop or Escape); phones (≤ 640 px): a top bar with the brand and a menu button that opens the full labelled menu as a drawer (same close rules), page scrolls as a whole; registry tables become cards; the LIRA button is compact and the page reserves space for it.
- Global stylesheets in a fixed cascade order (tokens/foundation → features → design system → workspaces → responsive last); component CSS lives with components; no `!important` to win fights; no dead selectors.

### 7.2 Registries

- `Page` + KPI filter cards + `FilterBar` + `RegistryTable` + `RegistryPagination` as in §4.0. Clickable rows open records; sort arrows in header buttons.
- **Phones (≤ 640 px)**: every registry table renders as cards: header hidden, each row a card, each cell shown as "column: value" using a `data-label` copied automatically from the header (honouring colspan).
- Toolbar actions use `RecordActions`; Print and Export are always present together and always icon-only (Printer and Download icons) with tooltip and aria-label.

### 7.3 Record shell

- `EntityRecordShell`: back button, avatar/icon, eyebrow (record code), title, subtitle, status badge(s), previous/next record, header actions, tabs (`CanonicalTabs`/`SubTabs`), single-screen fit where possible.
- Record utility actions via `PrintExportActions`; Export always performs a real action (generic fallback: structured JSON).

### 7.4 Dialogs and confirmations

- All modal forms use `ObserverDialog` (widths compact/standard/wide/workspace; presentation modal or workspace with Back). Footer order: secondary (cancel/close) then primary (save/complete).
- **Never** `window.confirm`/`window.alert`: use the app `confirm()` promise from the feedback context (title, message, confirm label, danger tone, optional required text input such as a reason or "DELETE 3").
- Destructive actions (delete, void, archive, cancel meeting) are behind confirmation; governed ones require a reason (`GovernedReasonDialog`).
- **Unsaved changes**: typing in a dialog marks it dirty (search/filter fields excluded); closing via ×, Back or backdrop asks "Discard changes?"; leaving/reloading the page warns. Screens follow the same rule (`UnsavedChangesGuard`) until a successful save notification or navigation.
- Notifications: success/warning/error toasts; undo where supported; user-facing error messages mapped from error codes (no raw stack traces).

### 7.5 Forms and dates

- No native `<input type="date|time">` in features: `ManualDateField` (dd/mm/yyyy typing + calendar picker, ISO stored internally) and `TimeField`.
- Displayed calendar day format follows the UI locale (Greek `20/8/2026`, English `20/08/2026`); one shared formatter.
- Long text uses a global textarea expander and stays vertically resizable; long read-only text uses an expandable block.
- Location autocomplete for Greek regions/cities; governed libraries for departments and master data (no hard-coded dropdowns).

### 7.6 Empty, loading and error states

- `EmptyState` with title + description explaining what to do next (e.g. "No samples yet — open the pending queue").
- Route loading skeleton; data-access status component distinguishing "no data", "not permitted", "module off", "error".
- Production never silently falls back to demo data: outside demo, fallbacks are empty-shaped.

### 7.7 Accessibility

- WCAG 2.1 A/AA checked with axe-core on every main screen, both languages, with dialogs/filters/notifications open.
- Icon-only buttons always have `aria-label` + tooltip; interactive cards are keyboard operable (Enter/Space); dialogs have `role="dialog"`, labelled, focus managed; `<html lang>` follows the UI language; distinct icons per navigation item.

### 7.8 Demo badge

- Inside a Demo organization: a slim bar above content showing whose Demo it is, days left (turns into a reminder in the last 3 days), the evaluation guide and "I want the application"; charts and print output are watermarked "DEMO". An expired/paused Demo shows a closed screen instead of data.

### 7.9 Bilingual i18n

- Greek is bundled and the default; English is a lazily loaded chunk. Returning English users preload English before first render; until loaded, lookups fall back to Greek.
- Keys may be flat or dot-namespaced per domain to avoid collisions. Clinical organism and antimicrobial names remain canonical data (not translated free text).
- No hard-coded Greek or English UI strings in new components; CI enforces EL/EN parity and tracks legacy debt baselines that may only go down.

---

## 8. Demo mode

### 8.1 Browser-only sample tenant

- A built-in sample hospital (`demo-hospital`) whose data comes from fixture modules per domain (patients, surveillance, laboratory, prevention, controls, quality, employees, indicators, pharmacy, clinical scales, analysis, management).
- Data lives in memory; mutations work in the session; a refresh restores the canonical seed.
- Browser storage is partitioned by environment and organization (`demo.<account>` vs `org.<organizationId>`), so demo data can never leak into a production organization.
- Used by the Platform Owner's demo preview and by the Help Center.

### 8.2 Help-preview iframe mode

- The Help Center embeds live screens in a same-origin iframe opened with `?helpPreview=1`. That frame uses an **isolated, anonymous, non-persisted Supabase client** (never the signed-in user's session), so RLS returns no production data and every screen runs on the demo dataset.
- `?helpOwner=1` additionally shows Platform Owner screens with sample hospitals/users/demos (read-only; saves not supported). Real sessions never see it.
- Platform screens with real organizations are not previewed live.

### 8.3 Demo clock

Fixtures are authored as if "today" were a fixed date (`DEMO_AUTHORED_ON`). On load, all dates shift by the days since then (0 under tests) so the story stays current:

- ISO date and date-time strings shift by whole days (keeping zone/no-zone form).
- Records with `periodStart`/`periodEnd` (monthly waste, antiseptics, dispensing) shift by **whole months**, keeping "1st to last day of month"; values tied to the period end follow it; period labels are rewritten.
- Monthly meetings shift by whole months and the month name in their title (Greek genitive and English) shifts with them.
- **Adult birth dates never shift** (birthdays stay fixed); infant birth dates (born within a year before the authored date) shift, because age at admission is part of the story.

### 8.4 Real Demo organizations

- The Owner creates a Demo with a wizard: customer & duration (default from platform setting), data scenario/pack, operating profile and add-ons, evaluator users with real roles (up to `max_demo_users`), review & send.
- Server: transactional creation (organization `is_demo=true`, entitlement, invitations), data pack seeded (relative dates, symbolic IDs → UUIDs, AST finalized last), invitations sent **only after** seeding completes; seeding refuses non-demo organizations.
- Lifecycle: preparing → active ⇄ paused → expired (computed "expiring soon" ≤ 7 days); extend (+7/+14/+30 days or date); reset data (wipe + reseed, Demo only); convert to customer (single transaction that wipes synthetic data first, sets `is_demo=false`, new name/code, entitlement `converted`, members keep roles, audited); delete (immediately) or auto-purge N days after expiry (`demo_auto_purge_after_days`, 0 = never).
- Evaluator experience: per-screen guides on first visit (excerpt of the Help manual; once per user, re-openable; `user_screen_guides`), evaluation guide with scenarios deep-linking to screens (progress in `demo_evaluation_progress`, visible to the Owner), "I want the application" request (`demo_application_requests`: new/contacted/closed).
- Inside a Demo only: Hospital Admin also has Occupational Health; members may switch their own role.

---

## 9. Help, onboarding and manual

- **One content source** (`{el, en}` pairs for every text) feeds the in-app Help Center and the PDF manual, so they cannot drift. Module/add-on names come from the operating-profile definitions.
- Content: purpose and audience; "Where am I?" table (situation → next stage); **journey** stages (Preparation → Create organization → Choose package/modules → Activate admin → Set up hospital: departments → users → libraries → patient-days → structural indicators → Go live → Daily use → Analysis & reports → Change modules later), each with who/where/steps/done-criteria; per-package step lists with first-week checks and success criteria; recipes (e.g. Basic + Laboratory + ΕΟΔΥ/EARS-Net); per-module what/users/needs/analysis/start; role list; glossary; FAQ ("I cannot see a module", "No invitation", "Forgot password", "Is data lost when I lock a module?", "An Analysis tab is empty", "Try without real patients").
- **Help Center**: chapters + screen manual sections mapped to routes (exact path, else longest prefix); each section shows a **live preview** of the real screen with demo data (thumbnail + enlarge), for the user's role and language.
- **Screen guides**: first-visit overlays in Demos (§8.4).
- **Illustrated PDF manual** (Greek and English) built by a script from the same content, embedding screenshots captured automatically from the demo build per manual section; served under `/manual/*`.
- A coverage audit fails when a route/screen has no manual section.

---

## 10. Non-functional requirements

### 10.1 Performance and resilience

- Every page is a lazy route (`React.lazy` per named export) behind `Suspense` with a loading skeleton.
- **Chunk recovery**: after a new deploy, an open tab requesting a removed chunk reloads once (guard stored in session storage); a second failure within 30 s shows the error screen instead of looping.
- **Error boundary per screen**: one failing screen never takes the app down; the menu stays usable, "Try again" re-renders, navigating clears the error.
- **Storage blocked**: if `localStorage` throws (strict privacy, embedded frames), show a specific explanation instead of a crash; all storage access goes through a safe wrapper.
- Concurrency: per-row targeted mutations per domain service so concurrent edits on different rows do not clobber each other; any whole-table save must detect a concurrent server change and reject instead of overwriting.
- Maintenance banner from platform settings; runtime diagnostics events to `platform_runtime_events`.

### 10.2 Versioning and release

- App version + build ID shown in About; CHANGELOG per release; database changes only via timestamped migrations committed to the repo (no runtime-generated SQL).
- Node version pinned (engines + host build environment).

### 10.3 CI pipeline

`npm run check` (same command locally and in CI) runs, in order:

| Audit | What it guards |
|---|---|
| clinical / lab / product i18n | No new hard-coded Greek in UIs; legacy debt baselines may only decrease. |
| English parity | Every Greek key has an English counterpart. |
| Help coverage | Every screen has a manual section. |
| Product permissions | Routes/navigation/actions use capabilities, no ad-hoc role arrays. |
| DB role alignment | Role lists in SQL helpers match the frontend role × capability matrix. |
| SECURITY DEFINER | Manifest vs replayed migrations (§6.2). |
| Navigation smoke | Every navigation item resolves to a gated route for the roles that see it. |
| React hooks smoke | Hooks rules/known crash patterns. |
| Frontend parity | Demo and production use the same canonical screens/loaders (allowlist for exceptions). |
| Observer UI | No visible Print/Export text, no native date/time inputs, record pages use `PrintExportActions`, Print never without Export, no legacy feature-specific form shells. |
| Dead CSS / dead selectors | No overridden declarations; no rules whose classes no code sets. |
| Strict typecheck | JSDoc-typed modules (permission model first) checked with `strict` + `checkJs`. |
| Lint, tests, build | ESLint zero warnings, Vitest, Vite build. |

Additional CI jobs: LIRA regression/safety test subset; **visual** job on PRs (build head and base, compare computed styles of every element on every main screen at desktop/tablet/phone, EL/EN, with dialogs/filters/notifications/record tabs; screenshots uploaded on change; intended changes need a `visual-change` label) plus the axe accessibility check that must always pass; **RLS** job running the SQL isolation test when a DB URL secret exists.

### 10.4 Testing strategy

- **Vitest + jsdom + Testing Library** for components (dialogs, unsaved-changes guard, error boundary, date field, overflow menu, idle lock) and pure logic (permission engine matrix, operating profile, demo clock, adherence, cluster detection, EARS-Net, notifiable findings, indicator metrics, training competence/effectiveness, calendar events).
- **Source contract tests**: read source files and assert structural rules (e.g. destructive actions behind confirmation, environment branching only in data layers, preview client isolation). Consequence: do not mass-reformat sources; format only touched files.
- **Permission matrix tests**: unique IDs, no unknown capabilities, scopes in range, system-only never via add-on/custom role, cross-org/cross-department/self/assignment/finalized denials.
- **SQL RLS test** (§6.7) and migration integrity tests.
- **Playwright**: visual regression, accessibility, manual screenshot capture.

---

## 11. Acceptance criteria

### Tenancy and authorization

1. A user with an active membership in organization A reads zero rows of organization B in every tenant table (`patients`, `surveillance_cases`, `laboratory_samples`, `quality_incidents`, `departments`, …).
2. A department user scoped to department A1 cannot read another department's patients, surveillance cases, samples or incidents.
3. A row with `department_id = null` is not visible to any department-scoped role.
4. An anonymous (`anon`) request returns no tenant rows from any table.
5. A user with no membership sees no organization data.
6. Pausing an organization (or a Demo expiring) blocks all its members' data access at the database level; resuming restores only the held memberships.
7. `platform_owner` cannot be assigned as an organization role, custom role, add-on or preview role.
8. The custom-role editor never offers `RESTRICTED` or `SYSTEM_ONLY` capabilities.
9. No add-on grants a system-only or governance capability; unknown add-on IDs are ignored without error.
10. A department-scoped role cannot be raised to organization scope by any override or custom capability.
11. A capability held by an assignment-only role (Doctor Reviewer, Committee Secretariat) is refused for a record without an active matching assignment.
12. Edit actions are refused on finalized records for every role.
13. Hospital Admin cannot read Occupational Health visits, vaccinations or exposures in a real (non-demo) organization; HR Office never can.
14. Role preview cannot perform any write; server calls use the real identity.
15. Every capability and role ID is unique, and every matrix row references a catalogue capability with an in-range scope.

### Operating profile

16. Switching a module off removes its menu item, routes (redirect/denied), actions, Analysis tabs and dashboard tiles for every role in that organization.
17. Switching the module back on shows the previously entered data unchanged.
18. Enabling a module whose prerequisite is off shows an "Also needs" warning but still allows saving.
19. A module list equal to a preset is reported as that preset; any other list as `custom`.

### Clinical and laboratory

20. A surveillance episode can hold several samples, isolation episodes, therapies and reassessments in any order; MDR/XDR/PDR is derived, never a required step.
21. An episode closure requires `close_surveillance`; reopening requires `reopen_surveillance`.
22. Surveillance shows laboratory results by reference; editing a result is possible only in the Laboratory module.
23. A critical result cannot be stored as communicated without a communication timestamp; each communication is a separate append-only record.
24. AST stores S/I/R with breakpoint standard/version; "I" is never counted as resistant.
25. Finalized AST rows cannot be modified (database guard).
26. EARS-Net export contains only blood/CSF isolates of the 8 pathogens, first isolate per patient/pathogen/year, and no patient code or name.
27. Cluster detection flags ≥ 3 same-organism, same-department positives within 14 days.

### Governance

28. A controlled document can be edited or deleted only in `draft`; each transition (review, approve, publish, supersede, archive) requires its own capability; publishing a new version marks the previous one superseded.
29. Committee minutes reach `finalized` only after the approval step; a rejection opens a revision cycle; cancelling a meeting requires a reason.
30. External minutes approval and training access links work without sign-in, only with a valid single-use token, and expose nothing else.
31. Voiding a control execution requires a reason and records actor and time; the voided execution stays visible in history.
32. Control executions with findings and failed bundle criteria without a CAPA appear in the Quality deviation queue and convert into a prefilled CAPA.
33. A CAPA progresses `open → in_progress → verification → closed` and records effectiveness verification.
34. The calendar lists controls, CAPA, audits, training, document reviews and committee meetings, each linking to its record, with overdue/due/planned state.
35. Indicators compute numerators from source records and denominators from effective patient-days; no screen asks to re-type a numerator.

### UI/UX

36. Every registry table renders as cards (one card per row, "column: value") at viewport width ≤ 640 px.
37. No `window.confirm`, `window.alert` or `window.prompt` appears anywhere in `src`.
38. No feature renders a native `<input type="date">` or `type="time"`; dates display as dd/mm/yyyy.
39. Every page with Print also has Export; both are icon-only with aria-labels.
40. Every record page uses the shared record shell with code, title, status and tabs, and offers a working Export.
41. Closing a dialog after typing asks for confirmation; closing without typing closes immediately; search/filter typing does not count.
42. Every visible string exists in Greek and English; switching language re-renders without reload and updates `<html lang>`.
43. axe-core reports zero WCAG 2.1 A/AA violations on every main screen in both languages.
44. An empty registry shows an explanatory empty state, not a blank table.

### Demo, help and resilience

45. Outside demo mode, no demo fixture data is ever shown (fallbacks are empty-shaped).
46. The Help Center preview iframe never uses the signed-in session and shows only demo data.
47. Demo dates are shifted relative to today; monthly periods remain whole calendar months; adult birth dates are unchanged.
48. An expired or paused Demo shows a closed screen and its data is inaccessible at the database level.
49. Converting a Demo to a customer removes all synthetic clinical data in the same transaction.
50. Deleting an organization is possible only through the password-rechecked deletion function; direct table deletes are refused; storage objects are removed; the action is audited.
51. A real organization's deletion requires a recent export or a recorded waiver and waits for the grace period; it can be cancelled before the date.
52. After a new deploy, an open tab that requests a missing chunk reloads once and does not loop.
53. A crash in one screen shows an error card with "Try again" while the navigation remains usable.
54. With blocked browser storage the app shows a specific explanation instead of crashing.
55. Edge functions reject non-allowlisted origins (CORS) and unauthenticated callers; username login and account recovery responses do not reveal whether an account exists.
56. Every SECURITY DEFINER function callable by `authenticated`/`anon` is declared in the manifest; `anon` reaches only `public-token` functions.
57. The idle lock engages after the configured minutes, survives a reload, and unlocks only with the same user's password.

---

## 12. Suggested build order and glossary

### 12.1 Phases

| Phase | Deliverables | Gate (from §11) |
|---|---|---|
| 0. Foundations | Vite/React/Router skeleton, design system primitives (Page, Button, IconButton, ObserverDialog, confirm, FilterBar, RegistryTable, RegistryPagination, MetricCard, EntityRecordShell, ManualDateField, TimeField, EmptyState), i18n EL/EN with lazy English, error boundary, chunk recovery, safe storage, CSP/headers, CI with lint/test/build. | 36–44, 52–54 |
| 1. Identity & tenancy | Supabase auth, profiles, organizations, memberships, departments, scopes; login (username), activation, recovery, reset; organization switcher; idle lock; audit log. | 1–6, 55, 57 |
| 2. Authorization | Capability catalogue, system role matrix, permission engine, add-ons, custom roles, role preview, role menu policy, RLS helpers + policies, SECURITY DEFINER manifest audit, SQL RLS test, DB-role alignment audit. | 7–15, 56 |
| 3. Operating profile & Platform Center | Packages/modules/add-ons, capability disabling, Platform Center organizations, platform settings, Management Center (users, roles, libraries, departments). | 16–19 |
| 4. Demo & Help infrastructure | Browser demo tenant with fixtures + demo clock, partitioned storage, Help Center with live preview iframe, help content source. | 45–47 |
| 5. Patients & Laboratory | Patients/admissions, samples, results, AST, AMR classification, critical communications, attachments. | 22–25 |
| 6. Surveillance | Episodes, assessments, HAI criteria, devices, isolation, therapy, reassessments, outcomes, timeline, clinical scales, cluster detection. | 20–21, 27 |
| 7. Indicators & reporting | Patient-days views, indicator definitions/snapshots, ΕΟΔΥ notifiable findings, EARS-Net export, data quality. | 26, 35 |
| 8. Prevention & Pharmacy | Hand hygiene, waste, antiseptics, bundles, staff vaccination, PPS, dispensing/DDD/AWaRe. | — |
| 9. Controls & Quality | Definitions, assignments, executions, adherence, calendar view; incidents, audits, findings, CAPA, root cause, deviation queue. | 31–33 |
| 10. Workforce | Employees, import, self profile, Occupational Health (visits, vaccinations, exposures). | 13 |
| 11. Training, Committees, Documents | Programmes/assessment/certificates/effectiveness/competence; committees/meetings/minutes approval/decisions; controlled document lifecycle, distribution, acknowledgements; public token pages. | 28–30 |
| 12. Calendar, Dashboard, Analysis | Cross-module calendar, role dashboards, Analysis tabs + PDF export, notifications/outbox, announcements. | 34 |
| 13. LIRA | Deterministic Q&A, provider gateway, knowledge RAG, outbreak investigations. | — |
| 14. Real Demos & offboarding | Demo wizard, seeding, evaluators, lifecycle, conversion, export, scheduled deletion, single deletion path, housekeeping, PDF manual, visual regression. | 48–51 |

### 12.2 Glossary

| Term | Meaning |
|---|---|
| IPC | Infection Prevention and Control (Πρόληψη και Έλεγχος Λοιμώξεων). |
| HAI | Healthcare-Associated Infection (Λοίμωξη σχετιζόμενη με τη φροντίδα υγείας / νοσοκομειακή λοίμωξη). |
| CLABSI | Central Line-Associated Bloodstream Infection. |
| CAUTI | Catheter-Associated Urinary Tract Infection. |
| VAP / VAE | Ventilator-Associated Pneumonia / Ventilator-Associated Event. |
| SSI | Surgical Site Infection. |
| Device-days | Sum of days patients carry a device; denominator of device-associated rates (per 1,000 device-days). |
| Patient-days (Ασθενοημέρες) | Total inpatient days in a period; denominator of most indicators. |
| MDR / XDR / PDR | Multidrug-, extensively drug- and pandrug-resistant organisms (ECDC/CDC definitions). |
| MDRO | Multidrug-resistant organism (e.g. MRSA, VRE, CRE, ESBL producers). |
| AST | Antimicrobial Susceptibility Testing (Αντιβιόγραμμα); results S/I/R with MIC or zone. |
| MIC | Minimum Inhibitory Concentration. |
| EUCAST | European Committee on Antimicrobial Susceptibility Testing (breakpoints; "I" = susceptible, increased exposure). |
| AMR | Antimicrobial Resistance (Μικροβιακή αντοχή). |
| AWaRe | WHO Access / Watch / Reserve antibiotic classification. |
| DDD | Defined Daily Dose (WHO ATC/DDD); consumption expressed as DDD per 100 patient-days. |
| ATC | Anatomical Therapeutic Chemical classification. |
| PPS | Point Prevalence Survey (Μελέτη επιπολασμού): HAI and antibiotic use on a given day. |
| CAPA | Corrective and Preventive Action (Διορθωτική και προληπτική ενέργεια). |
| 5 Whys / Ishikawa | Root-cause analysis techniques (question chain / fishbone diagram). |
| Bundle | Set of evidence-based practices assessed together (Yes/No/N/A), all-or-nothing compliance. |
| WHO 5 Moments | WHO hand hygiene opportunities: before patient contact, before aseptic task, after body-fluid exposure, after patient contact, after touching surroundings. |
| Link Nurse | Ward nurse acting as liaison with the IPC team. |
| Isolation / transmission-based precautions | Contact, droplet, airborne precautions (Μέτρα απομόνωσης). |
| Cluster / outbreak | Group of epidemiologically related cases (Συρροή / επιδημία). |
| Critical result | Lab result requiring immediate notification of the clinical team. |
| NHSN | CDC National Healthcare Safety Network (surveillance definitions). |
| CDC | US Centers for Disease Control and Prevention. |
| ECDC | European Centre for Disease Prevention and Control. |
| EARS-Net | European Antimicrobial Resistance Surveillance Network (ECDC); reports via TESSy. |
| WHONET | WHO microbiology data software; source of antimicrobial codes. |
| ΕΟΔΥ | Εθνικός Οργανισμός Δημόσιας Υγείας — Greek National Public Health Organization (notifiable diseases, HAI/AMR reporting). |
| ΥΑ 388/2014 | Greek ministerial decision Υ1.Γ.Π.114971/ΦΕΚ Β 388/2014 defining hospital IPC indicators (e.g. bacteraemia, resistance, antibiotic consumption, staff influenza vaccination). |
| ΥΠΕ | Υγειονομική Περιφέρεια — Greek regional health authority. |
| WHO IPCAF | WHO IPC Assessment Framework. |
| ISO 7101 | Healthcare organization quality management standard. |
| JCI | Joint Commission International hospital accreditation standards. |
| RLS | Postgres Row-Level Security. |
| SECURITY DEFINER | Postgres function running with its owner's rights (bypasses RLS); must check the caller itself. |
| Operating profile | Per-organization package + modules + add-ons chosen by the Platform Owner. |
| Capability / scope | One permitted action / the set of records it applies to (self, department, organization, platform). |
| LIRA | The built-in IPC assistant (deterministic rules + optional AI provider + approved knowledge). |
