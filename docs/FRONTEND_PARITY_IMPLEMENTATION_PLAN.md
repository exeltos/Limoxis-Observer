# Πλάνο ενοποίησης Frontend — Demo και Production

Ημερομηνία: 12/09/2026  
Κατάσταση: Proposed  
Σχετικό audit: [`FRONTEND_DEMO_PRODUCTION_PARITY_AUDIT.md`](./FRONTEND_DEMO_PRODUCTION_PARITY_AUDIT.md)

## 1. Στόχος

Να υπάρχει **ένα frontend προϊόν** για Demo και Production. Κάθε λειτουργία θα χρησιμοποιεί:

- το ίδιο page component,
- τα ίδια record components και forms,
- τα ίδια loading, empty, error και permission states,
- το ίδιο design system και τα ίδια translation keys,
- διαφορετικό repository μόνο για την ανάγνωση και αποθήκευση δεδομένων.

Το Demo θα συνεχίσει να έχει συνθετικά δεδομένα και το Production πραγματικά δεδομένα με Supabase/RLS. Δεν θα υπάρχει demo fallback στο Production και δεν θα αλλάξει το authorization model.

## 2. Αρχές που δεν διαπραγματευόμαστε

1. **Ένα route, ένα canonical page.** Κανένα route δεν επιλέγει `DemoPage` ή `CloudPage`.
2. **Η διαφορά περιβάλλοντος ανήκει στο data layer.** Το `isDemo` επιλέγει repository, όχι JSX.
3. **Τα components δεν γνωρίζουν Supabase rows.** Λαμβάνουν normalized domain models.
4. **Οι μεταβολές είναι capability-driven.** Η εμφάνιση actions βασίζεται σε permissions, όχι στο Demo/Production mode.
5. **Το backend παραμένει το όριο ασφαλείας.** Το frontend δεν υποκαθιστά RLS ή governed RPCs.
6. **Καμία big-bang αντικατάσταση.** Κάθε module μεταφέρεται πίσω από προσωρινό feature flag και παραδίδεται αυτόνομα.
7. **Το παλιό component διαγράφεται μετά τη μετάβαση.** Δεν κρατάμε δεύτερη «προσωρινή» υλοποίηση χωρίς ημερομηνία λήξης.

## 3. Προτεινόμενη δομή φακέλων

Κάθε feature αποκτά την ίδια εσωτερική δομή:

```text
src/features/<feature>/
├── pages/
│   ├── <Feature>Page.jsx
│   └── <Feature>RecordPage.jsx
├── components/
│   ├── <Feature>Registry.jsx
│   ├── <Feature>Form.jsx
│   ├── <Feature>Summary.jsx
│   └── <Feature>EmptyState.jsx
├── hooks/
│   ├── use<Feature>Registry.js
│   └── use<Feature>Record.js
├── repositories/
│   ├── <feature>Repository.js
│   ├── demo<Feature>Repository.js
│   └── supabase<Feature>Repository.js
├── model/
│   ├── <feature>Model.js
│   ├── <feature>Mappers.js
│   └── <feature>Validation.js
└── index.js
```

Δεν χρειάζεται να μετακινηθούν όλα τα αρχεία από την πρώτη ημέρα. Η δομή εφαρμόζεται ανά module καθώς ενοποιείται, ώστε τα PRs να παραμένουν ελέγξιμα.

## 4. Κοινά contracts

### 4.1 Repository result

Όλα τα repositories επιστρέφουν κοινό αποτέλεσμα:

```js
{
  data,
  readiness: 'ready' | 'not_configured' | 'empty',
  missingConfiguration: [],
}
```

Τα errors δεν μετατρέπονται σε κενά arrays. Περνούν από το κοινό error mapping ώστε το UI να διακρίνει αποτυχία φόρτωσης από πραγματικά κενό registry.

### 4.2 Registry controller

Κάθε `use<Feature>Registry` εκθέτει τουλάχιστον:

```js
{
  rows,
  loading,
  error,
  readiness,
  filters,
  pagination,
  capabilities,
  reload,
  openRecord,
  createRecord,
}
```

Το page συνθέτει το layout. Το hook διαχειρίζεται δεδομένα και state. Το repository εκτελεί I/O.

### 4.3 Record controller

Κάθε `use<Feature>Record` εκθέτει:

```js
{
  record,
  loading,
  error,
  permissions,
  lifecycle,
  save,
  transition,
  reload,
}
```

Τα components δεν ελέγχουν `isDemo`. Ελέγχουν `permissions.canEdit`, `permissions.canFinalize` κ.λπ.

### 4.4 Κανονικοποίηση μοντέλων

- Τα Supabase snake_case rows μετατρέπονται σε domain models μόνο στους mappers.
- Τα demo fixtures περνούν από τους ίδιους validators/mappers.
- Η μορφοποίηση ημερομηνίας, labels και status γίνεται στο presentation layer.
- IDs που χρειάζονται το backend (`recordId`) παραμένουν διακριτά από display codes (`id`/`code`).

## 5. Κοινά UI building blocks

Πριν από την ενοποίηση των modules, ορίζονται και επαναχρησιμοποιούνται:

| Ανάγκη | Canonical component |
| --- | --- |
| Page header και actions | `Page`, `RecordActions` |
| Registry | `RegistryTable`, `RegistryPagination`, `FilterBar` |
| Record | `EntityRecordShell`, `PrintExportActions` |
| Dialog | `ObserverDialog`, `ConfirmDialog`, `GovernedReasonDialog` |
| Forms | `Field`, `ManualDateField`, `TimeField`, `SaveButton` |
| Feedback | `FeedbackContext`, κοινό error mapping |
| States | κοινά `LoadingState`, `ReadinessState`, `EmptyState`, `ErrorState` |

Προσθέτουμε νέα shared component μόνο όταν εξυπηρετεί τουλάχιστον δύο πραγματικές χρήσεις. Δεν δημιουργούμε αφηρημένα components μόνο για να μειωθεί ο αριθμός γραμμών.

## 6. Workstreams

### Workstream A — Foundation και guardrails

**Παραδοτέα**

1. `useFeatureRepository` ή αντίστοιχο dependency injection από το data environment.
2. Κοινό repository result και error contract.
3. Κοινά readiness components.
4. `audit:frontend-parity` που αποτρέπει νέα page-level branches.
5. Test helpers που εκτελούν το ίδιο component με Demo και Supabase-shaped fixtures.
6. Visual baseline για desktop και mobile viewport.

**Definition of Done**

- Δεν προστίθεται νέο `*DemoPage` ή `*CloudPage`.
- Το audit επιτρέπει μόνο καταγεγραμμένα legacy splits.
- Κάθε legacy εξαίρεση έχει owner, migration issue και ημερομηνία λήξης.

### Workstream B — Εργαστήριο

Το Εργαστήριο γίνεται πρώτο επειδή έχει τη μεγαλύτερη αναλογία Demo/Production UI και σαφή workflow boundaries.

**Σειρά**

1. Ορισμός `LaboratoryRepository` για registry, record, create και lifecycle actions.
2. Mappers για patient, employee και environmental samples.
3. Ένα κοινό `LaboratoryPage` με registry, KPIs, filters και readiness states.
4. Ένα κοινό `LaboratorySampleForm` μέσα σε `ObserverDialog`.
5. Ένα κοινό `LaboratorySampleRecordPage` με sections:
   - overview/receipt,
   - result,
   - organisms και AST,
   - critical communication,
   - attachments,
   - finalization/history.
6. Μεταφορά Demo και Supabase writes στα repositories.
7. Διαγραφή των `LaboratoryDemoPage`, `LaboratoryCloudPage`, `LaboratorySampleDemoRecordPage` και `LaboratorySampleCloudRecordPage` μετά το rollout.

**Έλεγχοι**

- patient, employee και environmental sample,
- positive/negative/critical result,
- draft, finalized και governed correction,
- editable και read-only role,
- empty, not configured, loading και backend error.

### Workstream C — Επιτήρηση

**Σειρά**

1. Ορισμός `SurveillanceRepository` και normalized case model.
2. Μεταφορά της σημερινής route-level normalization στους mappers.
3. Κοινό registry για patient, employee και environment tabs.
4. Κοινό create flow.
5. Κοινό patient clinical record με domain sections:
   - start/context,
   - assessment,
   - samples,
   - HAI/AMR,
   - therapy,
   - isolation,
   - reassessment/outcome,
   - timeline.
6. Κοινά lifecycle transitions για close, void και reopen.
7. Διαγραφή των παλιών Demo/Production route branches.

**Κρίσιμος περιορισμός**

Τα clinical transitions δεν γίνονται optimistic χωρίς επιβεβαίωση backend. Το Demo repository μπορεί να τα προσομοιώνει, αλλά το canonical UI εμφανίζει completion μόνο όταν επιστρέψει επιτυχία το repository.

### Workstream D — Δείκτες και Analytics

**Σειρά**

1. Κοινό indicator definition/result model.
2. Demo metrics adapter που επιστρέφει το ίδιο schema με τα production metrics.
3. Κοινό workspace για calculate, save, review και approve.
4. Readiness states για definitions, patient days/denominators και departments.
5. Κοινά charts και explanatory states.
6. Διαγραφή των `IndicatorsDemoPage` και `IndicatorsCloudPage`.

### Workstream E — Οριζόντια ποιότητα

Εκτελείται παράλληλα με κάθε module:

- μεταφορά visible strings στο κεντρικό i18n dictionary,
- keyboard/focus tests,
- responsive checks στα 375 px, 768 px και 1440 px,
- κοινό logging/diagnostics για failed repository actions,
- bundle-size παρακολούθηση,
- διαγραφή νεκρών CSS selectors και legacy components.

## 7. Backlog σε μικρά PRs

Κάθε γραμμή είναι ανεξάρτητο, reviewable PR:

| PR | Περιεχόμενο | Εξάρτηση |
| --- | --- | --- |
| 1 | Parity audit script και legacy allow-list | — |
| 2 | Repository result/error/readiness contracts | 1 |
| 3 | Shared readiness UI και tests | 2 |
| 4 | Laboratory model, mappers και repository interface | 2 |
| 5 | Laboratory registry ενοποίηση | 3, 4 |
| 6 | Laboratory create form/dialog ενοποίηση | 4 |
| 7 | Laboratory record sections: overview/result | 4 |
| 8 | Laboratory record sections: AST/communication | 7 |
| 9 | Laboratory finalization/history και legacy cleanup | 5–8 |
| 10 | Surveillance model, mappers και repository interface | 2 |
| 11 | Surveillance registry/create flow | 3, 10 |
| 12 | Patient clinical record shared sections | 10, 11 |
| 13 | Surveillance lifecycle και legacy cleanup | 12 |
| 14 | Indicator model και metrics adapter | 2 |
| 15 | Indicator workspace ενοποίηση και cleanup | 3, 14 |
| 16 | Cross-module visual/accessibility regression suite | 9, 13, 15 |

Κανένα PR δεν πρέπει να συνδυάζει μαζικές μετακινήσεις αρχείων, αλλαγή persistence και οπτικό redesign μαζί. Έτσι είναι σαφές αν ένα regression προέρχεται από data behavior ή UI composition.

## 8. Testing strategy

### Unit tests

- mappers με Demo και Supabase-shaped input,
- validation και lifecycle rules,
- permission-to-action mapping,
- readiness classification,
- error normalization.

### Component tests

Το ίδιο canonical component εκτελείται δύο φορές:

1. με Demo repository,
2. με fake Supabase repository που επιστρέφει ισοδύναμα δεδομένα.

Ελέγχονται ίδιοι τίτλοι, tabs, fields, statuses και allowed actions. Διαφορές επιτρέπονται μόνο σε environment badge ή σε action που πράγματι δεν υποστηρίζεται από το repository contract.

### End-to-end tests

Για κάθε module:

- registry → record → back με αποκατάσταση φίλτρων/scroll,
- create → save → εμφάνιση στο registry,
- validation failure,
- backend failure και retry,
- read-only role,
- keyboard-only βασική ροή,
- EL/EN αλλαγή γλώσσας χωρίς απώλεια state.

### Visual tests

Σταθερά fixture datasets και κοινά viewports για:

- populated registry,
- empty/not-configured state,
- open create dialog,
- record σε editable και read-only mode,
- long Greek και English content.

Δεν συγκρίνουμε production live δεδομένα με Demo δεδομένα. Συγκρίνουμε το ίδιο canonical component με ισοδύναμα fixtures.

## 9. Rollout χωρίς διακοπή παραγωγής

1. Προσωρινό feature flag ανά module, π.χ. `VITE_CANONICAL_LAB_UI`.
2. Ενεργοποίηση πρώτα σε local/test και μετά σε Demo.
3. Production shadow validation των reads και mappers χωρίς διπλά writes.
4. Pilot σε έναν production tenant και περιορισμένο σύνολο ρόλων.
5. Έλεγχος diagnostics, failed actions και support feedback.
6. Γενική ενεργοποίηση.
7. Διαγραφή flag και legacy components στο αμέσως επόμενο PR.

Δεν κρατάμε μόνιμα δύο code paths. Κάθε flag έχει owner και removal date.

## 10. Definition of Done ανά module

Ένα module θεωρείται ενοποιημένο όταν:

- Demo και Production routes εισάγουν το ίδιο page και record component,
- κανένα presentation component δεν διαβάζει `isDemo`,
- όλα τα I/O περνούν από το repository interface,
- Demo και Supabase data περνούν από κοινό normalized model,
- loading, readiness, empty και error states έχουν δοκιμές,
- permissions και RLS-negative cases έχουν δοκιμές,
- EL/EN, keyboard και responsive checks περνούν,
- visual snapshots έχουν εγκριθεί,
- τα legacy components, CSS και allow-list entries έχουν διαγραφεί,
- περνά ολόκληρο το `npm run check`.

## 11. Προτεινόμενη σειρά προτεραιότητας

1. **Foundation/guardrails**, ώστε να σταματήσει άμεσα νέο drift.
2. **Εργαστήριο**, επειδή έχει τη μεγαλύτερη οπτική και δομική απόκλιση.
3. **Επιτήρηση**, επειδή είναι το πιο κρίσιμο και σύνθετο clinical workflow.
4. **Δείκτες/Analytics**, αφού σταθεροποιηθούν τα upstream domain models.
5. **Οριζόντιο cleanup**, αφαίρεση flags, legacy CSS και παλιών components.

## 12. Πρώτο sprint

Το πρώτο sprint δεν ξεκινά με redesign. Παραδίδει τη βάση:

1. parity audit script και allow-list των σημερινών splits,
2. repository/readiness/error contracts,
3. shared readiness components,
4. Laboratory model και mappers,
5. component test που αποδίδει το ίδιο Laboratory registry με Demo και production-shaped fixtures.

Με αυτό το sprint αποκτούμε εφαρμόσιμο pattern. Τα επόμενα PRs επαναλαμβάνουν το ίδιο pattern αντί να αποφασίζουν ξανά την αρχιτεκτονική σε κάθε feature.
