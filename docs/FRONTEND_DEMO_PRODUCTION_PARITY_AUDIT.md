# Αξιολόγηση frontend — Demo / Production parity

Ημερομηνία: 12/09/2026  
Έκδοση που εξετάστηκε: `0.47.4`  
Μέθοδος: στατική επιθεώρηση των route boundaries, των page components, του design system και των αυτοματοποιημένων frontend checks.

Το αναλυτικό πλάνο εκτέλεσης βρίσκεται στο [`FRONTEND_PARITY_IMPLEMENTATION_PLAN.md`](./FRONTEND_PARITY_IMPLEMENTATION_PLAN.md).

## Συμπέρασμα

Η παρατήρηση ότι «το Demo είναι καλύτερο από το παραγωγικό» είναι βάσιμη. Το βασικό πρόβλημα δεν είναι ένα μεμονωμένο CSS regression ή η έλλειψη production δεδομένων. Σε τρεις κρίσιμες περιοχές το Demo και το Production αποδίδονται από **διαφορετικά page/record components**:

- Επιτήρηση (`SurveillancePage` / `ProductionSurveillancePage` και δύο διαφορετικά patient record pages).
- Εργαστήριο (`LaboratoryDemoPage` / `LaboratoryCloudPage` και δύο διαφορετικά sample record pages).
- Δείκτες (`IndicatorsDemoPage` / `IndicatorsCloudPage`).

Αυτό έχει δημιουργήσει δύο προϊόντα που εξελίσσονται ανεξάρτητα. Οι διορθώσεις UX στο ένα περιβάλλον δεν φτάνουν αυτόματα στο άλλο και η οπτική/λειτουργική απόκλιση αυξάνεται με κάθε αλλαγή.

Το Training δείχνει ήδη τη σωστή κατεύθυνση: χρησιμοποιεί ένα canonical frontend (`TrainingProductionPage`) και μεταφέρει τις διαφορές Demo/Production στο service/data layer.

## Ευρήματα

### P0 — Διπλή υλοποίηση των βασικών οθονών

| Περιοχή | Demo | Production | Γραμμές Demo / Production |
| --- | --- | --- | ---: |
| Επιτήρηση registry | `SurveillancePage.jsx` | `ProductionSurveillancePage.jsx` | 220 / 180 |
| Επιτήρηση record | `PatientClinicalRecordPage.jsx` | `PatientClinicalCloudRecordPage.jsx` | 768 / 286 |
| Εργαστήριο registry | `LaboratoryDemoPage.jsx` | `LaboratoryCloudPage.jsx` | 228 / 51 |
| Εργαστήριο record | `LaboratorySampleDemoRecordPage.jsx` | `LaboratorySampleCloudRecordPage.jsx` | 838 / 163 |
| Δείκτες | `IndicatorsDemoPage.jsx` | `IndicatorsCloudPage.jsx` | 152 / 63 |

Οι διαφορές μεγέθους δεν αποδεικνύουν μόνες τους χαμηλότερη ποιότητα, δείχνουν όμως ότι το Production δεν χρησιμοποιεί το ίδιο interaction model και το ίδιο component tree με το Demo. Ιδιαίτερα στα record pages, το Demo έχει πολλαπλάσια UI επιφάνεια. Αυτό εξηγεί γιατί μπορεί να φαίνεται πληρέστερο, πιο «δεμένο» και πιο ώριμο.

**Απόφαση:** δεν πρέπει να γίνει προσπάθεια να «ομορφύνουν» ξεχωριστά τα production pages. Πρέπει να καταργηθεί το page-level branching και να υπάρχει ένα canonical component ανά registry και record. Το `isDemo` πρέπει να επιλέγει repository/adapters και fixture data, όχι διαφορετικό JSX.

### P0 — Το Production αποκλίνει από το ίδιο το UI contract

Το canonical UI contract απαιτεί:

- `ObserverDialog` για νέους διαλόγους.
- `ManualDateField` και `TimeField` αντί για native date/time inputs.
- `EntityRecordShell` για record pages.
- κοινές actions μέσω `RecordActions` και `PrintExportActions`.

Παρόλα αυτά, η νέα φόρμα δείγματος του production Εργαστηρίου χρησιμοποιεί custom `modal-backdrop` / `entry-card`, δικό της κουμπί κλεισίματος και native `datetime-local`. Έτσι, ακόμη και όταν η production λειτουργία υπάρχει, παρουσιάζεται με διαφορετική γλώσσα διεπαφής από το Demo και από το documented design system.

**Απόφαση:** η φόρμα δημιουργίας δείγματος πρέπει να μεταφερθεί σε κοινό `LaboratorySampleForm`, μέσα σε `ObserverDialog`, με shared date/time controls. Το ίδιο component πρέπει να τροφοδοτεί demo και production repositories.

### P1 — Το Demo είναι «σκηνοθετημένο», το Production είναι data-dependent

Το Demo φορτώνει πλούσια synthetic datasets και προκαθορισμένα trends/KPIs. Το Production εξαρτάται από:

- πραγματικές εγγραφές οργανισμού,
- ενεργούς ορισμούς και κεντρικές βιβλιοθήκες,
- permissions και department scope,
- επιτυχημένα Supabase reads,
- επαρκές ιστορικό για analytics.

Άρα ένα νέο ή ελλιπώς παραμετροποιημένο production tenant μπορεί να είναι τεχνικά σωστό αλλά οπτικά άδειο. Σήμερα το empty state συνήθως περιγράφει μόνο ότι «δεν υπάρχουν εγγραφές»· δεν εξηγεί ποια αρχική ρύθμιση λείπει ούτε προσφέρει σαφές επόμενο βήμα.

**Απόφαση:** κάθε production module χρειάζεται readiness state, όχι απλώς empty state:

1. `not configured` — λείπουν libraries/definitions/departments,
2. `configured, no activity` — είναι έτοιμο αλλά δεν έχει δεδομένα,
3. `active` — υπάρχουν λειτουργικά δεδομένα,
4. `error` — αποτυχία φόρτωσης με ασφαλές retry και correlation detail.

Για κάθε κατάσταση πρέπει να υπάρχει role-aware CTA, π.χ. «Ρύθμιση ορισμών», «Νέο δείγμα» ή «Επικοινωνήστε με τον διαχειριστή».

### P1 — Ασυνεπής διεθνοποίηση

Το συνολικό `npm run check` σταματά στο πρώτο βήμα, επειδή το clinical i18n audit εντοπίζει hard-coded ελληνικό κείμενο στο production empty state των Ασθενών. Υπάρχουν επίσης αρκετά local `el ? ... : ...` ζεύγη μέσα σε feature components αντί να χρησιμοποιείται το κεντρικό dictionary.

Αυτό δεν είναι μόνο θέμα μετάφρασης: τα δύο περιβάλλοντα μπορούν να αποκτήσουν διαφορετικό wording, terminology και layout length, αφού δεν μοιράζονται τα ίδια translation keys.

**Απόφαση:** όλα τα canonical components να χρησιμοποιούν κεντρικά translation keys. Τα inline bilingual ternaries να επιτρέπονται μόνο προσωρινά και να εμποδίζονται από audit πριν από merge.

### P1 — Η parity δεν ελέγχεται από tests

Τα υπάρχοντα audits προστατεύουν σημαντικούς κανόνες (i18n, permissions, navigation, hooks και Observer UI patterns), αλλά δεν υπάρχει έλεγχος που να αποτυγχάνει όταν ένα route εισάγει διαφορετικά Demo/Production page components.

**Απόφαση:** νέο `audit:frontend-parity` που ελέγχει τουλάχιστον:

- απαγόρευση `isDemo ? <DemoPage/> : <CloudPage/>` στα route/page boundaries,
- απαγόρευση νέων `*DemoPage` / `*CloudPage` ζευγών,
- allow-list μόνο για προσωρινές migrations με ιδιοκτήτη και ημερομηνία λήξης,
- shared visual smoke suite για Demo και Production fixtures στο ίδιο canonical component.

### P2 — Μεγάλα, πυκνά components αυξάνουν το drift

Τα μεγαλύτερα Demo record pages συγκεντρώνουν εκατοντάδες γραμμές UI και workflow logic σε ένα αρχείο. Η αντιγραφή τους προς Production δεν είναι ασφαλής λύση: θα διπλασιάσει bugs, accessibility gaps και κόστος συντήρησης.

**Απόφαση:** εξαγωγή κοινών domain components ανά workflow section (overview, result, AST, communication, finalization, history) και σύνδεσή τους με environment-neutral view models.

## Προτεινόμενη αρχιτεκτονική

```text
Route
  └── CanonicalPage
        ├── shared design-system components
        ├── shared domain sections
        └── useFeatureRepository()
              ├── DemoRepository (fixtures/local persistence)
              └── SupabaseRepository (production/RLS)
```

Το canonical page δεν πρέπει να γνωρίζει αν εκτελείται σε Demo ή Production. Πρέπει να λαμβάνει:

- normalized view models,
- loading/error/readiness state,
- διαθέσιμες actions βάσει capability,
- callbacks με κοινά contracts.

Οι διαφορές ασφάλειας παραμένουν στο backend/RLS και στο permission engine. Η ενοποίηση του frontend δεν σημαίνει εξομοίωση δικαιωμάτων ή χρήση demo fallback σε production.

## Σειρά υλοποίησης

### Φάση 1 — Guardrails και baseline (1–2 ημέρες)

1. Προσθήκη `audit:frontend-parity`.
2. Καταγραφή visual snapshots για τις βασικές διαδρομές σε κοινό viewport.
3. Καταγραφή readiness matrix ανά production tenant/module.
4. Διόρθωση των σημερινών failures του `npm run check` πριν ξεκινήσει η ενοποίηση.

### Φάση 2 — Εργαστήριο (3–5 ημέρες)

Το Εργαστήριο έχει τη μεγαλύτερη εμφανή απόκλιση και αποτελεί καλό πρώτο vertical slice:

1. Κοινό registry page.
2. Κοινό sample creation dialog/form.
3. Κοινό sample record shell και workflow sections.
4. Demo και Supabase repositories πίσω από το ίδιο interface.
5. Parity tests για populated, empty, loading, error και read-only states.

### Φάση 3 — Επιτήρηση (5–8 ημέρες)

1. Ενοποίηση registry και create flow.
2. Ενοποίηση patient clinical record.
3. Normalization στο repository/view-model boundary, όχι μέσα στο route.
4. Έλεγχος όλων των role/capability combinations.

### Φάση 4 — Δείκτες και Analytics (3–5 ημέρες)

1. Κοινό indicator workspace.
2. Demo metrics ως adapter στο ίδιο result schema.
3. Production readiness/onboarding για definitions, denominators και approvals.
4. Ίδια charts και explanatory states και στα δύο περιβάλλοντα.

## Κριτήρια αποδοχής

Η parity θεωρείται ολοκληρωμένη όταν:

- η ίδια route αποδίδει το ίδιο canonical page component σε Demo και Production,
- layout, tabs, actions, empty/loading/error states και responsive behavior είναι κοινά,
- οι διαφορές περιορίζονται σε data source, permissions και πραγματική διαθεσιμότητα actions,
- δεν χρησιμοποιούνται demo fixtures ως production fallback,
- `npm run check` περνά πλήρως,
- visual tests συγκρίνουν τις δύο λειτουργίες με ισοδύναμα fixture datasets,
- keyboard navigation, focus order, labels και contrast ελέγχονται και στις δύο λειτουργίες.

## Άμεση σύσταση

Να παγώσουν οι ξεχωριστές UX βελτιώσεις στα `*DemoPage` και `*CloudPage`. Κάθε νέα frontend εργασία στις παραπάνω περιοχές πρέπει είτε να γίνεται σε shared component είτε να αποτελεί βήμα κατάργησης του page split. Διαφορετικά, ακόμη και σωστές μεμονωμένες αλλαγές θα συνεχίσουν να κάνουν το Demo και το Production να αποκλίνουν.
