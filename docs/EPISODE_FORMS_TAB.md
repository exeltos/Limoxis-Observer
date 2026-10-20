# Καρτέλα «Φόρμες & ερωτηματολόγια»

Μία καρτέλα του φακέλου ασθενή (`/patients/:id`, ανά νοσηλεία) και του επεισοδίου επιτήρησης
(`/surveillance/:id`) με όλες τις φόρμες που συνδέονται με το επεισόδιο, σε συμπτυσσόμενες
ενότητες. Η παλιά καρτέλα «Κλινικές αξιολογήσεις» είναι πλέον η ενότητα «Κλίμακες»: τα σήματα
NEWS2 / Braden / GCS της κεφαλίδας και ο σύνδεσμος `?tab=clinicalScales` ανοίγουν αυτή την
ενότητα. Σχεδιασμός: `docs/design/episode-forms/` (README.md, NOTES.md).

## Κανόνες ομοιομορφίας (σκληρή απαίτηση)

- **Μία γραμμή για κάθε φόρμα** (`forms/FormRow.jsx`): τίτλος με γραμμή λεπτομέρειας, κατάσταση
  σε απλές λέξεις (**Εκκρεμεί · Ολοκληρώθηκε · Εκπρόθεσμη**), τελευταία ημερομηνία, **μία**
  ενέργεια («Νέα» / «Άνοιγμα», στις δέσμες «Ιστορικό»). Χρώμα μόνο για σήμα ασφαλείας
  (εκπρόθεσμη, δηλωτέο, υψηλός κίνδυνος κλίμακας).
- **Η ίδια προσυμπλήρωση** (`forms/formPrefill.js`): ασθενής, νοσηλεία, επεισόδιο. Κάθε φόρμα
  που ανοίγει από το επεισόδιο τη δείχνει ως κλειδωμένη λίστα «Προσυμπληρωμένα»
  (`forms/PrefilledList.jsx`), όχι ως πεδία.
- **Το ίδιο κενό μήνυμα** (`FormEmpty`): μία πρόταση που λέει τι θα εμφανιστεί και πού ξεκινά η
  ενέργεια. Ποτέ κενός πίνακας.
- **Μία ενέργεια, ένα μέρος**: νέος έλεγχος δέσμης μόνο στη γραμμή της συσκευής («Έλεγχος
  δέσμης», καρτέλα «Επιτήρηση & Δείγματα»).
- Η κατάσταση **υπολογίζεται**, δεν αποθηκεύεται (`forms/formStatus.js`). Ημερομηνίες σε ώρα
  Ευρώπης/Αθήνας.

## Ενότητες

| Σειρά | id | Αρχείο | Δεδομένα | Ποιος τη βλέπει |
|---|---|---|---|---|
| 10 | `bundles` | `sections/bundlesSection.jsx` | `prevention_bundle_assessments` (`surveillance_case_id`, `surveillance_device_id`, `patient_id`, `device_day`) | VIEW_SURVEILLANCE και (record_prevention_bundle ή VIEW_PREVENTION), module πρόληψης |
| 20 | `scales` | `sections/scalesSection.jsx` | `patient_clinical_scale_assessments` (+ `surveillance_case_id`), μέσω του `PatientClinicalScalesPanel` | VIEW_SURVEILLANCE ή VIEW_PATIENTS |
| 30 | `notifiable` | `sections/notifiableSection.jsx` | `notifiable_disease_reports` μέσω `sample_id` / `patient_id` | διαχειριστής, ΟΕΛ, εργαστήριο (και πλατφόρμα). Φαίνεται και **χωρίς νοσηλεία** · «Νέα δήλωση» ανοίγει τον κατάλογο των 57 νοσημάτων του ΕΟΔΥ (`docs/reference/eody-katalogos-nosimaton-2022.pdf`, `src/features/reporting/eodyCatalogue.js`)· κάθε γραμμή δείχνει τον χρόνο δήλωσης (αμέσως / 24 ώρες / εβδομάδα) και πόσος χρόνος απομένει ή έχει περάσει |
| 40 | `incidents` | `sections/incidentsSection.jsx` | `quality_incidents` (`linked_surveillance_id`, `linked_patient_id`, `linked_admission_id`) | REPORT_INCIDENT ή VIEW_QUALITY |
| 90 | `outbreak` | `sections/outbreakSection.jsx` | `lira_outbreak_case_reviews.patient_id` (μόνο ανάγνωση) | διαχειριστής, ΟΕΛ, εργαστήριο, ιατρός αξιολογητής, διευθυντής ποιότητας |
| 95 | `exposureSource` | `sections/exposureSourceSection.jsx` | `surveillance_case_exposure_count(uuid)` (μόνο αριθμός) | όποιος βλέπει το επεισόδιο· σύνδεσμος μόνο για ιατρό εργασίας |

Εκτός καρτέλας: η ενότητα «Έκθεση προσωπικού» (`EmployeeExposureSection.jsx`) στην εγγραφή
επιτήρησης εργαζομένου `/surveillance/staff/:id`, με τα ίδια στοιχεία (`FormSection`, `FormRow`,
`PrefilledList`).

## Σημείο επέκτασης: μητρώο ενοτήτων

Η καρτέλα (`forms/EpisodeFormsTab.jsx`) δεν ξέρει τις ενότητες. Τις διαβάζει από
`forms/formsRegistry.js`. Μια νέα ενότητα (π.χ. τα ερωτηματολόγια) είναι ένα αντικείμενο:

```js
export const questionnairesSection = {
  id: 'questionnaires',          // μοναδικό· είναι και το deep link: openSection('questionnaires')
  order: 50,                     // θέση στην καρτέλα (10, 20 … αφήστε κενά)
  withoutAdmission: false,       // true: φαίνεται και σε ασθενή χωρίς νοσηλεία (όπως το «Δηλωτέα»)
  canSee: ctx => ctx.has(CAPABILITIES.VIEW_CONTROLS),        // δικαίωμα / module· false = δεν εμφανίζεται
  load: ctx => loadQuestionnaires(ctx.organizationId, …),    // προαιρετικό, async· γίνεται μία φορά ανά επεισόδιο
  Component: QuestionnairesSection,   // ({ ctx, section, reload, openSection }) => <FormSection …/>
  buildReport: (ctx, section) => ({ id, title, list }) | null, // η ενότητα στην εκτυπωμένη αναφορά
}
```

Βήματα:

1. Γράψτε το αρχείο στο `forms/sections/` και προσθέστε το αντικείμενο στον πίνακα `REGISTERED` του
   `formsRegistry.js` (ή καλέστε `registerEpisodeFormSection(definition)`).
2. Το `Component` επιστρέφει `<FormSection id title icon summary defaultOpen needsAttention
   actions>` με περιεχόμενο `FormRows` / `FormRow` (ή `FormEmpty`). Η `needsAttention` ανοίγει
   την ενότητα μόνη της· το `summary` είναι η γραμμή που φαίνεται όταν είναι διπλωμένη.
3. Η προσυμπλήρωση της φόρμας: `episodeContext(ctx)` και `PrefilledList` (`formPrefill.js`).
   Η επιστροφή στην καρτέλα: `ctx.goTo(path, { returnTab: 'episodeForms', state })` και στη σελίδα
   της φόρμας `goBack()`.
4. Κείμενα: νέο μπλοκ μέσα στο `episodeForms` των `stringsEl.js` / `stringsEn.js` (ελληνικά και
   αγγλικά), εγγραφή στο κεφάλαιο «Φόρμες & ερωτηματολόγια» του `helpManual.js` /
   `helpManualEn.js`.
5. Βάση: το νέο σχήμα έχει `organization_id`, σύνθετο FK `(id, organization_id)` προς το
   επεισόδιο, RLS και, αν ο πίνακας είναι νέος, restrictive `<πίνακας>_module_gate`
   (`20261201200000_module_enforcement_db.sql`).
6. Τεστ: ένα αρχείο ανά ενότητα στο στυλ των `tests/episodeForms*.test.jsx` (ορατότητα ανά ρόλο,
   γραμμές, κενή κατάσταση, εκτύπωση).

`ctx` (το φτιάχνει η σελίδα, `PatientClinicalCanonicalPage.jsx`): `organizationId`, `isDemo`,
`language`, `t`, `role`, `has(capability)`, `patient`, `admission`, `record` (επιλεγμένο
επεισόδιο ή null), `episodes` (επεισόδια της νοσηλείας ή το ένα επεισόδιο), `samples`,
`patientMode`, `fmtDate`, `fmtDateTime`, `goTo`, `returnPath`, `startProtocol`.

Τα δεδομένα των ενοτήτων με `load` διαβάζονται στη σελίδα (`forms/useEpisodeFormsData.js`) και
όχι στην καρτέλα, ώστε να τα βλέπουν και η γραμμή συσκευής της καρτέλας «Επιτήρηση & Δείγματα»
και η εκτυπωμένη αναφορά.

## Βάση (migrations 20261204…)

| Αρχείο | Τι προσθέτει |
|---|---|
| `20261204100000_bundle_assessment_episode_links.sql` | στήλες + σύνθετα FK στο `prevention_bundle_assessments`, restrictive select `…_case_scope` |
| `20261204110000_scale_assessment_episode_link.sql` | `patient_clinical_scale_assessments.surveillance_case_id` |
| `20261204120000_incident_episode_links.sql` | FK (validated) για `quality_incidents.linked_*`, `linked_admission_id` |
| `20261204130000_exposure_episode_links.sql` | `employee_surveillance_record_id`, `source_case_id`, `surveillance_case_exposure_count()` |
| `20261204130100_exposure_count_privileges.sql` | μόνο `authenticated` μπορεί να καλέσει τη νέα συνάρτηση |

Δεν αλλάζει καμία υπάρχουσα πολιτική RLS, δεν γίνεται drop ή revoke σε υπάρχον αντικείμενο.
Ανοιχτά ζητήματα του ιδιοκτήτη (ποιοι ρόλοι συμπληρώνουν δέσμη, SSI, δηλωτέο σε ιατρό, κ.ά.):
`docs/design/episode-forms/NOTES.md`.
