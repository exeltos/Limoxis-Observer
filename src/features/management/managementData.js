export const demoUsers = [
  { id: 'u1', name: 'Demo Administrator', email: 'admin@demo.hospital', role: 'hospital_admin', status: 'active' },
  { id: 'u2', name: 'Ελένη Παπαδοπούλου', email: 'infection@demo.hospital', role: 'infection_control_lead', status: 'active' },
  { id: 'u3', name: 'Νίκος Δημητρίου', email: 'laboratory@demo.hospital', role: 'laboratory', status: 'active' },
]

export const demoOrganizations = [
  { id: 'demo-hospital', name: 'Demo Hospital', code: 'DEMO', type: 'hospital', status: 'active', members: 3 },
]

export const demoLibrarySeed = {
  departments:[['ΜΕΘ','ICU'],['Χειρουργική','Surgery'],['Παθολογική','Internal Medicine']],
  microorganisms:[['Escherichia coli','Escherichia coli'],['Klebsiella pneumoniae','Klebsiella pneumoniae'],['Staphylococcus aureus','Staphylococcus aureus']],
  antibiotics:[['Μεροπενέμη','Meropenem'],['Πιπερακιλλίνη/Ταζομπακτάμη','Piperacillin/Tazobactam'],['Βανκομυκίνη','Vancomycin']],
  notifiableDiseases:[['Ιλαρά','Measles'],['Μηνιγγιτιδοκοκκική νόσος','Meningococcal disease'],['Φυματίωση','Tuberculosis']],
  sampleTypes:[['Αίμα','Blood'],['Ούρα','Urine'],['Αναπνευστικό','Respiratory']],
  professionalCategories:[['Ιατρός','Physician'],['Νοσηλευτής/τρια','Nurse'],['Μαία/Μαιευτής','Midwife']],
  vaccines:[['Ηπατίτιδα Β','Hepatitis B'],['Γρίπη','Influenza'],['COVID-19','COVID-19']],
  wasteTypes:[['ΕΑΑΜ','Infectious healthcare waste'],['ΜΕΑ','Mixed hazardous waste'],['ΑΕΑ','Other hazardous waste']],
  antiseptics:[['Αλκοολούχο αντισηπτικό χεριών','Alcohol-based hand rub'],['Χλωρεξιδίνη','Chlorhexidine']],
  isolationTypes:[['Επαφής','Contact'],['Σταγονιδίων','Droplet'],['Αερογενής','Airborne']],
  controlTypes:[['Έλεγχος εφαρμογής μέτρων απομόνωσης','Isolation precautions audit'],['Έλεγχος ΜΑΠ','PPE audit']],
  documentCategories:[['Πολιτική','Policy'],['Διαδικασία','Procedure'],['Οδηγία','Guideline'],['Έντυπο','Form']],
}

export const demoPatientDayPeriods = [
 {id:'pd1',from:'2026-08-01',to:'2026-08-31',scope:'department',departmentEl:'ΜΕΘ',departmentEn:'ICU',value:372,source:'manual'},
 {id:'pd2',from:'2026-07-01',to:'2026-07-31',scope:'hospital',departmentEl:'',departmentEn:'',value:5214,source:'manual'},
]
