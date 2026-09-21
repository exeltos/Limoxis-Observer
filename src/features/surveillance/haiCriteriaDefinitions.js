// Simplified, indicative checklists inspired by CDC/NHSN surveillance definitions for the
// HAI types offered in the classification dialog. They are a decision-support aid, not a
// substitute for the full NHSN protocol or clinical judgement — the free-text rationale
// field remains available for anything the checklist does not capture.
//
// This is now also the demo-mode/offline-fallback content: in production, the same sets are
// centrally governed as master_library_items rows (library_key 'hai_criteria', see
// haiCriteriaLibraryService.js) so a Platform Owner can edit/version them without a deploy,
// exactly like the antibiotics/microorganisms libraries.
export const HAI_CRITERIA_SETS = {
  clabsi: {
    labelEl: 'CLABSI – Λοίμωξη αιματικής ροής σχετιζόμενη με κεντρικό φλεβικό καθετήρα',
    labelEn: 'CLABSI – Central line-associated bloodstream infection',
    source: 'CDC/NHSN (simplified)',
    groups: [
      {
        id: 'device',
        rule: 'all',
        items: [
          { id: 'centralLine48h', textEl: 'Κεντρικός φλεβικός καθετήρας in situ για >2 ημερολογιακές ημέρες πριν την ημερομηνία έναρξης', textEn: 'Central line in place for >2 calendar days before the date of event' },
        ],
      },
      {
        id: 'micro',
        rule: 'any',
        items: [
          { id: 'recognizedPathogen', textEl: 'Αναγνωρισμένο παθογόνο σε ≥1 καλλιέργεια αίματος, χωρίς σχέση με λοίμωξη άλλης εντόπισης', textEn: 'A recognized pathogen from ≥1 blood culture, unrelated to infection at another site' },
          { id: 'commonCommensalTwice', textEl: 'Κοινός δερματικός κομμενσαλιστής σε ≥2 καλλιέργειες αίματος σε διαφορετικές λήψεις + κλινικά σημεία (πυρετός >38°C, ρίγος ή υπόταση)', textEn: 'A common skin commensal from ≥2 separate blood cultures + a clinical sign (fever >38°C, chills, or hypotension)' },
        ],
      },
    ],
  },
  cauti: {
    labelEl: 'CAUTI – Ουρολοίμωξη σχετιζόμενη με ουροκαθετήρα',
    labelEn: 'CAUTI – Catheter-associated urinary tract infection',
    source: 'CDC/NHSN (simplified)',
    groups: [
      {
        id: 'device',
        rule: 'all',
        items: [
          { id: 'catheter48h', textEl: 'Ουροκαθετήρας in situ για >2 ημερολογιακές ημέρες πριν την ημερομηνία έναρξης', textEn: 'Indwelling urinary catheter in place for >2 calendar days before the date of event' },
        ],
      },
      {
        id: 'clinical',
        rule: 'any',
        items: [
          { id: 'fever', textEl: 'Πυρετός (>38°C)', textEn: 'Fever (>38°C)' },
          { id: 'suprapubicTenderness', textEl: 'Υπερηβική ευαισθησία', textEn: 'Suprapubic tenderness' },
          { id: 'urgencyFrequencyDysuria', textEl: 'Επιτακτική ούρηση, συχνουρία ή δυσουρία (μετά την αφαίρεση καθετήρα)', textEn: 'Urinary urgency, frequency or dysuria (after catheter removal)' },
        ],
      },
      {
        id: 'micro',
        rule: 'all',
        items: [
          { id: 'positiveUrineCulture', textEl: 'Θετική καλλιέργεια ούρων ≥10⁵ CFU/mL, με ≤2 είδη μικροοργανισμών', textEn: 'Positive urine culture ≥10⁵ CFU/mL, with ≤2 species of organisms' },
        ],
      },
    ],
  },
  vap: {
    labelEl: 'VAP – Πνευμονία σχετιζόμενη με μηχανικό αερισμό',
    labelEn: 'VAP – Ventilator-associated pneumonia',
    source: 'CDC/NHSN (simplified)',
    groups: [
      {
        id: 'device',
        rule: 'all',
        items: [
          { id: 'ventilator48h', textEl: 'Μηχανικός αερισμός για >2 ημερολογιακές ημέρες πριν την ημερομηνία έναρξης', textEn: 'Mechanical ventilation for >2 calendar days before the date of event' },
          { id: 'newInfiltrate', textEl: 'Νέο, προϊόν ή επίμονο διήθημα στην απεικόνιση θώρακος', textEn: 'New, progressive or persistent infiltrate on chest imaging' },
        ],
      },
      {
        id: 'clinical',
        rule: 'atLeastTwo',
        items: [
          { id: 'temperatureAbnormal', textEl: 'Πυρετός ή υποθερμία', textEn: 'Fever or hypothermia' },
          { id: 'wbcAbnormal', textEl: 'Λευκοπενία ή λευκοκυττάρωση', textEn: 'Leukopenia or leukocytosis' },
          { id: 'mentalStatusChange', textEl: 'Νέα διαταραχή επιπέδου συνείδησης (ηλικιακά προσαρμοσμένη)', textEn: 'New onset of altered mental status (age-adjusted)' },
          { id: 'purulentSecretions', textEl: 'Νέα πυώδης τραχειοβρογχική έκκριση', textEn: 'New onset of purulent tracheobronchial secretions' },
        ],
      },
      {
        id: 'micro',
        rule: 'any',
        items: [
          { id: 'respiratoryCulturePositive', textEl: 'Θετική καλλιέργεια αναπνευστικού δείγματος (τραχειοβρογχικές εκκρίσεις / BAL) πάνω από το ποσοτικό κατώφλι', textEn: 'Positive quantitative respiratory culture (tracheal aspirate / BAL) above the diagnostic threshold' },
        ],
      },
    ],
  },
  clabsi_neonatal: {
    labelEl: 'CLABSI (νεογνική/βρεφική) – Λοίμωξη αιματικής ροής σχετιζόμενη με κεντρικό καθετήρα σε ασθενή ≤1 έτους',
    labelEn: 'CLABSI (neonatal/infant) – Central line-associated bloodstream infection in a patient ≤1 year',
    source: 'CDC/NHSN (simplified, age ≤1 year LCBI criteria)',
    groups: [
      {
        id: 'device',
        rule: 'all',
        items: [
          { id: 'centralLine48h', textEl: 'Κεντρικός φλεβικός καθετήρας in situ για >2 ημερολογιακές ημέρες πριν την ημερομηνία έναρξης', textEn: 'Central line in place for >2 calendar days before the date of event' },
        ],
      },
      {
        id: 'micro',
        rule: 'any',
        items: [
          { id: 'recognizedPathogen', textEl: 'Αναγνωρισμένο παθογόνο σε ≥1 καλλιέργεια αίματος, χωρίς σχέση με λοίμωξη άλλης εντόπισης', textEn: 'A recognized pathogen from ≥1 blood culture, unrelated to infection at another site' },
          { id: 'commonCommensalTwiceInfant', textEl: 'Κοινός δερματικός κομμενσαλιστής σε ≥2 καλλιέργειες αίματος σε διαφορετικές λήψεις + ένα από: πυρετός (>38°C), υποθερμία (<36°C πυρήνα), άπνοια ή βραδυκαρδία', textEn: 'A common skin commensal from ≥2 separate blood cultures + one of: fever (>38°C core), hypothermia (<36°C core), apnea, or bradycardia' },
        ],
      },
    ],
  },
  ssi: {
    labelEl: 'SSI – Λοίμωξη χειρουργικού πεδίου',
    labelEn: 'SSI – Surgical site infection',
    source: 'CDC/NHSN (simplified)',
    groups: [
      {
        id: 'timing',
        rule: 'all',
        items: [
          { id: 'withinWindow', textEl: 'Εντός 30 ημερών από την επέμβαση (ή 90 ημερών εφόσον υπάρχει εμφύτευμα)', textEn: 'Within 30 days of the procedure (or 90 days if an implant is present)' },
        ],
      },
      {
        id: 'depth',
        rule: 'any',
        items: [
          { id: 'superficialPurulent', textEl: 'Επιπολής τομή: πυώδης έκκριση ή θετική καλλιέργεια από το δέρμα/υποδόριο', textEn: 'Superficial incisional: purulent drainage or organism isolated from skin/subcutaneous tissue' },
          { id: 'deepPurulentOrDehiscence', textEl: 'Εν τω βάθει τομή: πυώδης έκκριση από εν τω βάθει τομή, ή αυτόματη/σκόπιμη διάνοιξη με πυρετό ή εντοπισμένο πόνο', textEn: 'Deep incisional: purulent drainage from the deep incision, or spontaneous/deliberate dehiscence with fever or localized pain' },
          { id: 'organSpaceAbscess', textEl: 'Όργανο/κοιλότητα: πυώδης έκκριση από παροχέτευση, θετική καλλιέργεια ή απόστημα σε όργανο/κοιλότητα που χειρουργήθηκε', textEn: 'Organ/space: purulent drainage from a drain, organism from culture, or an abscess involving the operated organ/space' },
        ],
      },
    ],
  },
}

export function haiCriteriaSetForType(typeKey, sets = HAI_CRITERIA_SETS) {
  return sets[typeKey] || null
}

function groupSatisfied(group, selectedIds) {
  const metCount = group.items.filter(item => selectedIds.has(item.id)).length
  if (group.rule === 'all') return metCount === group.items.length
  if (group.rule === 'atLeastTwo') return metCount >= 2
  return metCount > 0
}

export function evaluateHaiCriteria(typeKey, selectedIds = [], sets = HAI_CRITERIA_SETS) {
  const set = haiCriteriaSetForType(typeKey, sets)
  if (!set) return null
  const selected = new Set(selectedIds)
  return set.groups.every(group => groupSatisfied(group, selected))
}
