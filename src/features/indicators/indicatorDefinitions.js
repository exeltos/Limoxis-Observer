export const indicatorDefinitions = [
  {id:'active-surveillance',category:'surveillance',titleEl:'Ενεργές επιτηρήσεις',titleEn:'Active surveillance episodes',unit:'περιστατικά',unitEn:'episodes',numerator:'active_surveillance',denominator:null,multiplier:1,version:'2026.2',source:'Επιτήρηση',calculation:'auto',target:null,direction:'context'},
  {id:'amr-rate',category:'surveillance',titleEl:'Ποσοστό AMR / MDR-XDR',titleEn:'AMR / MDR-XDR rate',unit:'%',unitEn:'%',numerator:'resistant_active_surveillance',denominator:'active_surveillance',multiplier:100,version:'2026.2',source:'Επιτήρηση',calculation:'auto',target:25,direction:'lower'},
  {id:'who-hh',category:'prevention',titleEl:'Συμμόρφωση Υγιεινής Χεριών WHO',titleEn:'WHO hand hygiene compliance',unit:'%',unitEn:'%',numerator:'compliant_hh_actions',denominator:'hh_opportunities',multiplier:100,version:'2026.2',source:'Πρόληψη · WHO',calculation:'auto',target:85,direction:'higher'},
  {id:'bundle-all-or-none',category:'prevention',titleEl:'Bundle all-or-none compliance',titleEn:'Bundle all-or-none compliance',unit:'%',unitEn:'%',numerator:'bundle_all_or_none_pass',denominator:'bundle_executions',multiplier:100,version:'2026.2',source:'Πρόληψη · Bundles',calculation:'auto',target:90,direction:'higher'},
  {id:'abhr',category:'prevention',titleEl:'Κατανάλωση αλκοολούχου αντισηπτικού',titleEn:'Alcohol-based hand rub consumption',unit:'L/1.000 ασθενείς-ημέρες',unitEn:'L/1,000 patient-days',numerator:'abhr_litres',denominator:'patient_days',multiplier:1000,version:'2026.2',source:'Πρόληψη · Αντισηπτικά',calculation:'auto',target:null,direction:'context'},
  {id:'training',category:'workforce',titleEl:'Συμμόρφωση εκπαίδευσης',titleEn:'Training compliance',unit:'%',unitEn:'%',numerator:'completed_training_assignments',denominator:'training_assignments',multiplier:100,version:'2026.2',source:'Εκπαίδευση',calculation:'auto',target:90,direction:'higher'},
  {id:'staff-vaccination',category:'workforce',titleEl:'Εμβολιαστική κάλυψη προσωπικού',titleEn:'Staff vaccination coverage',unit:'%',unitEn:'%',numerator:'active_staff_with_vaccination_record',denominator:'active_staff',multiplier:100,version:'2026.2',source:'Εργαζόμενοι',calculation:'auto',target:null,direction:'context'},
  {id:'open-high-incidents',category:'quality',titleEl:'Ανοιχτά συμβάντα υψηλής σοβαρότητας',titleEn:'Open high-severity incidents',unit:'συμβάντα',unitEn:'incidents',numerator:'open_high_incidents',denominator:null,multiplier:1,version:'2026.2',source:'Ποιότητα',calculation:'auto',target:0,direction:'lower'},
]

export const indicatorCategoryLabels={
 surveillance:'Επιτήρηση',prevention:'Πρόληψη',workforce:'Προσωπικό',quality:'Ποιότητα'
}
