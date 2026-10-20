# Printed records as a report

The owner asked for «εκτύπωση σαν report, όχι με πίνακες και χρώματα». A record page now
prints as a clinical document, not as the screen.

## How it works

- `EntityRecordShell` takes `printReport` (an object, or a function called only while
  printing). While printing, the shell renders `RecordReportPrint` instead of the tabs.
- `src/design-system/recordReport.js` cleans the description: blank values are dropped,
  empty sections are left out (or, with `keep: true`, say «Δεν υπάρχουν καταγραφές»), the
  remaining sections are numbered 1…N, history is sorted chronologically.
- `src/design-system/RecordReportPrint.jsx` + `src/styles/record-report.css` lay it out:
  letterhead (hospital, optional logo as data URL, record type and code, print date,
  «Εκτυπώθηκε από»), title, status as plain words, «Περίληψη», numbered sections.
  Serif 11 pt, A4 margins 20 mm, black on white, thin grey rules only. The page boxes
  repeat the header (hospital + record code) and print «Σελίδα Χ από Υ» and
  «Εμπιστευτικό — περιέχει δεδομένα υγείας» (CSS `@page` margin boxes; the closing lines
  in the body carry the same text where margin boxes are unsupported).
- A record page without `printReport` keeps the old behaviour (every tab in sequence),
  now in the same plain style (`print.css`: serif, black/white, no badges or chips).

## Description

```js
{ kind, code, title, subtitle, statusLabel, status, summaryText, summaryPairs: [[label, value]],
  sections: [{ id, title, intro?, pairs?, items?: [{ title, meta?, pairs?, list?, text?, table? }],
               list?, events?: [{ when, sort, title, detail?, by? }], text?, documents?, keep?, emptyText? }] }
```

Rules for a builder: labels are the screen's own labels (never raw keys), values in words
(S/I/R as «Ευαίσθητο / Ανθεκτικό»), only what the user can see (permission flags decide
the sections), no JSX in values. Builders are pure and unit-tested
(`tests/recordReportPrint.test.jsx`).

## Done

| Record | Builder | Sections |
|---|---|---|
| Surveillance episode / patient admission | `features/surveillance/surveillanceReport.js` | 1 Στοιχεία ασθενούς · 2 Επιτήρηση (ταξινόμηση, αξιολόγηση, συσκευές, απομόνωση, αγωγή, επανεκτιμήσεις, έκβαση) · 3 Δείγματα και αποτελέσματα · οι ορατές ενότητες της καρτέλας «Φόρμες & ερωτηματολόγια» (Δέσμες πρόληψης συσκευών · Κλίμακες · Δηλωτέα νοσήματα · Συμβάντα · Επιδημιολογικό ιστορικό (προέλευση, παράγοντες κινδύνου, απαντήσεις) · Συνδέεται με έξαρση · Πηγή έκθεσης προσωπικού), κάθε μία από το `buildReport` της στο μητρώο `forms/formsRegistry.js`, μόνο για ρόλους που τις βλέπουν · Έγγραφα · Ιστορικό |
| Laboratory sample | `features/laboratory/laboratorySampleReport.js` | 1 Στοιχεία δείγματος · 2 Πρόοδος · 3 Μικροβιολογικό αποτέλεσμα (αντιβιόγραμμα ανά μικροοργανισμό) · Ενημέρωση κρίσιμου · Έγγραφα · Ιστορικό |

## To follow (same shell, a builder each)

| Record | Sections |
|---|---|
| Quality incident / non-conformity | 1 Στοιχεία συμβάντος · 2 Περιγραφή και ταξινόμηση · 3 Ανάλυση αιτίας · 4 Διορθωτικές / προληπτικές ενέργειες (item ανά ενέργεια: υπεύθυνος, προθεσμία, κατάσταση) · 5 Έγγραφα · 6 Ιστορικό |
| Risk / opportunity, review, meeting | 1 Στοιχεία · 2 Αξιολόγηση / ατζέντα · 3 Αποφάσεις και ενέργειες · 4 Έγγραφα · 5 Ιστορικό |
| Supplier / equipment | 1 Στοιχεία · 2 Αξιολόγηση / βαθμονομήσεις και συντήρηση (ιστορικό ως λίστα) · 3 Έγγραφα · 4 Ιστορικό |
| Employee | 1 Στοιχεία εργαζομένου · 2 Θέση και τμήμα · 3 Εκπαίδευση · 4 Εμβολιασμοί και επιτήρηση (Υγεία Εργασίας) · 5 Έγγραφα και πιστοποιητικά · 6 Ιστορικό. Ευαίσθητα δεδομένα μόνο με δικαίωμα προβολής. |
| Committee / meeting | 1 Στοιχεία επιτροπής · 2 Μέλη (λίστα) · 3 Συνεδριάσεις και αποφάσεις · 4 Έγγραφα · 5 Ιστορικό |
| Occupational health (case / vaccination) | 1 Στοιχεία εργαζομένου · 2 Περιστατικό / εμβόλιο · 3 Μέτρα και παρακολούθηση · 4 Έγγραφα · 5 Ιστορικό |
| Kitchen (day / receipt) | 1 Στοιχεία ημέρας / παραλαβής · 2 Θερμοκρασίες και έλεγχοι (item ανά μέτρηση) · 3 Παρατηρήσεις και ανάκληση · 4 Έγγραφα · 5 Ιστορικό |
| Prevention, control, indicator | 1 Στοιχεία · 2 Αποτελέσματα / μετρήσεις (item ανά περίοδο) · 3 Ενέργειες · 4 Έγγραφα · 5 Ιστορικό |
| Platform organization / demo | Εκτός εύρους (εσωτερική οθόνη, όχι κλινική εγγραφή) |

Adding one: build the description in `features/<area>/<record>Report.js`, pass
`printReport={() => build…(…)}` to the record's `EntityRecordShell`, add a builder test.
