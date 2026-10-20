# Αίτημα δείγματος (Sample request form)

Ο κανόνας: **ΔΕΙΓΜΑ = Εργαστήριο** (καταχώριση, αποτέλεσμα, AST). **ΛΟΙΜΩΞΗ ασθενή = Επιτήρηση** (επεισόδιο).
Ένα επεισόδιο έχει πολλά δείγματα· πολλά δείγματα δεν γίνονται ποτέ επεισόδιο. Χωρίς διπλή καταχώριση.

## Τι κάνει το «Αίτημα δείγματος»

Από το επεισόδιο (καρτέλα «Δείγματα» και «Επανέλεγχος» ανά δείγμα) ο χρήστης στέλνει **αίτημα** στο εργαστήριο.
Δημιουργείται γραμμή `laboratory_samples` σε κατάσταση `requested`, δεμένη με τον ασθενή και το επεισόδιο
(`surveillance_case_id`), με το τμήμα, τον τύπο/θέση δείγματος και την προτεραιότητα. Το εργαστήριο την παραλαμβάνει
(«Αναμένεται λήψη» στη λίστα Εργαστηρίου), καταγράφει τη λήψη και εισάγει το αποτέλεσμα. Αποτέλεσμα δεν εισάγεται
από την Επιτήρηση. Ο επανέλεγχος κρατά τον κωδικό `<δείγμα>-R<n>`.

Αρχεία:

- `src/features/surveillance/ClinicalRecordDialogs.jsx` — `SampleRequestDialog` (η φόρμα).
- `src/features/laboratory/sampleRequestForm.js` — σημείο επέκτασης: `SAMPLE_REQUEST_QUESTIONS`, `emptySampleRequest`,
  `missingRequestFields`, `sampleRequestPayload`.
- `src/features/surveillance/clinicalCloudService.js` (`requestLaboratorySample`) και `clinicalRepository.js`
  (`requestSample`, demo: προσθέτει και γραμμή στη λίστα Εργαστηρίου).
- `src/features/surveillance/ClinicalSurveillanceWorkspace.jsx` — «Επανέλεγχος» (`saveSample`).

## Πώς προστίθεται ερώτηση

Στο `SAMPLE_REQUEST_QUESTIONS` πρόσθεσε αντικείμενο:

```js
{
  key: 'fever', kind: 'choice', required: true,
  label: { el: 'Πυρετός', en: 'Fever' },
  options: [
    { value: 'yes', label: { el: 'Ναι', en: 'Yes' } },
    { value: 'no', label: { el: 'Όχι', en: 'No' } },
  ],
}
```

`kind` είναι `choice` ή `text`. Η φόρμα τις εμφανίζει μετά τα βασικά πεδία, εφαρμόζει τον κοινό κανόνα επικύρωσης
(`useFormValidation`, «*» στα υποχρεωτικά) και παραδίδει τις απαντήσεις στο `onSave` ως
`requestQuestions: { [key]: value }`. Το `requestQuestions` περνά μέχρι το `draft` του `createLaboratorySample` και το
demo· **δεν υπάρχει ακόμη στήλη αποθήκευσης**: ο builder που προσθέτει τις ερωτήσεις προσθέτει και τη στήλη
(π.χ. `request_questions jsonb`) και τη γράφει στο `createLaboratorySample` / `requestLaboratorySample`.
Κάθε ορατό κείμενο έχει ελληνικά και αγγλικά (`label.el` / `label.en`).

## Προς έλεγχο (worklist)

Νέα θετικά/ειδοποιητικά δείγματα χωρίς επεισόδιο και χωρίς απόφαση εμφανίζονται στον Έλεγχο Λοιμώξεων
(`infection_control_lead`, `infection_control_member`, `doctor_reviewer`, `hospital_admin`): κάρτα «Προς έλεγχο (N)»
στην Αρχική και κάρτα-φίλτρο στη λίστα «Επεισόδια επιτήρησης». Οι δύο ενέργειες ζουν μόνο εκεί:
«Άνοιγμα επεισοδίου» (δένει το δείγμα με το νέο επεισόδιο) και «Δεν χρειάζεται επιτήρηση» (λόγος: Επιμόλυνση /
Αποικισμός / Γνωστό περιστατικό / Άλλο, και προαιρετική σημείωση). Η απόφαση γράφεται μόνο με τη συνάρτηση
`review_laboratory_sample` (SECURITY DEFINER, στο manifest) στις στήλες `surveillance_review_*`.
Λογική επιλογής: `src/features/laboratory/sampleReviewModel.js`. Τα αρνητικά δεν εμφανίζονται ποτέ και δεν διαγράφονται.
