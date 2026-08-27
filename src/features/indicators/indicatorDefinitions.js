export const indicatorDefinitions = [
  { id:'bsi-incidence', category:'surveillance', titleEl:'Επίπτωση βακτηριαιμιών', titleEn:'Bloodstream infection incidence density', unit:'/1.000 ασθενείς-ημέρες', unitEn:'/1,000 patient-days', numerator:'confirmed_bsi', denominator:'patient_days', multiplier:1000, version:'2026.1' },
  { id:'pps', category:'surveillance', titleEl:'Σημειακός επιπολασμός (PPS)', titleEn:'Point prevalence survey (PPS)', unit:'%', unitEn:'%', numerator:'hai_cases_on_survey', denominator:'patients_on_survey', multiplier:100, version:'2026.1' },
  { id:'amr-rate', category:'surveillance', titleEl:'Ποσοστό AMR / MDR-XDR', titleEn:'AMR / MDR-XDR rate', unit:'%', unitEn:'%', numerator:'resistant_isolates', denominator:'eligible_isolates', multiplier:100, version:'2026.1' },
  { id:'ddd', category:'stewardship', titleEl:'Κατανάλωση αντιμικροβιακών (DDD)', titleEn:'Antimicrobial consumption (DDD)', unit:'DDD/1.000 ασθενείς-ημέρες', unitEn:'DDD/1,000 patient-days', numerator:'ddd_total', denominator:'patient_days', multiplier:1000, version:'2026.1' },
  { id:'advanced-antibiotics', category:'stewardship', titleEl:'Χρήση προωθημένων αντιβιοτικών', titleEn:'Restricted/advanced antibiotic use', unit:'%', unitEn:'%', numerator:'approved_advanced_antibiotic_courses', denominator:'advanced_antibiotic_requests', multiplier:100, version:'2026.1' },
  { id:'who-hh', category:'prevention', titleEl:'Συμμόρφωση Υγιεινής Χεριών WHO', titleEn:'WHO hand hygiene compliance', unit:'%', unitEn:'%', numerator:'compliant_hh_actions', denominator:'hh_opportunities', multiplier:100, version:'2026.1' },
  { id:'mdr-isolation', category:'prevention', titleEl:'Έγκαιρη απομόνωση MDR/XDR', titleEn:'Timely MDR/XDR isolation', unit:'%', unitEn:'%', numerator:'timely_mdr_isolations', denominator:'mdr_cases_requiring_isolation', multiplier:100, version:'2026.1' },
  { id:'staff-vaccination', category:'workforce', titleEl:'Εμβολιαστική κάλυψη προσωπικού', titleEn:'Staff vaccination coverage', unit:'%', unitEn:'%', numerator:'covered_staff', denominator:'eligible_active_staff', multiplier:100, version:'2026.1' },
  { id:'training', category:'workforce', titleEl:'Συμμόρφωση εκπαίδευσης', titleEn:'Training compliance', unit:'%', unitEn:'%', numerator:'completed_training_assignments', denominator:'required_training_assignments', multiplier:100, version:'2026.1' },
]

export const indicatorDemoValues = {
  'bsi-incidence': 2.6, pps: 8.4, 'amr-rate': 31.7, ddd: 742, 'advanced-antibiotics': 91.2,
  'who-hh': 78.6, 'mdr-isolation': 88.9, 'staff-vaccination': 84.1, training: 93.4,
}
