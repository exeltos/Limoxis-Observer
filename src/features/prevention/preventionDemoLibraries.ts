// The Demo hospital's prevention libraries: departments, waste types, antiseptic
// products and the care-bundle templates (the sample records use them).
export const preventionDepartments = [
  { id: 'dep-icu', el: 'ΜΕΘ', en: 'ICU' },
  { id: 'dep-internal', el: 'Παθολογική', en: 'Internal Medicine' },
  { id: 'dep-surgery', el: 'Χειρουργική', en: 'Surgery' },
  { id: 'dep-ed', el: 'ΤΕΠ', en: 'ED' },
  { id: 'dep-cardio', el: 'Καρδιολογική', en: 'Cardiology' },
  { id: 'dep-nicu', el: 'Νεογνολογική / ΜΕΝΝ', en: 'Neonatal / NICU' },
  { id: 'dep-ortho', el: 'Ορθοπαιδική', en: 'Orthopedics' },
]

export const wasteTypeLibrary = [
  { id: 'wt-infectious', code: 'WASTE-INF', el: 'Μολυσματικά απόβλητα', en: 'Infectious waste' },
  { id: 'wt-sharps', code: 'WASTE-SHARP', el: 'Αιχμηρά αντικείμενα', en: 'Sharps' },
  {
    id: 'wt-pharma',
    code: 'WASTE-PHARMA',
    el: 'Φαρμακευτικά απόβλητα',
    en: 'Pharmaceutical waste',
  },
]

export const antisepticLibrary = [
  {
    id: 'ant-abhr',
    code: 'ANT-ABHR',
    el: 'Αλκοολούχο αντισηπτικό χεριών (ABHR)',
    en: 'Alcohol-based handrub (ABHR)',
    metadata: { is_abhr: true },
  },
  {
    id: 'ant-surgical',
    code: 'ANT-SURG',
    el: 'Χειρουργικό αντισηπτικό διάλυμα',
    en: 'Surgical antiseptic solution',
    metadata: { is_abhr: false },
  },
]

export const bundleTemplateLibrary = [
  {
    dbId: 'tmpl-clabsi',
    id: 'CLABSI',
    bundleKey: 'CLABSI',
    name: 'CLABSI Bundle',
    title: 'Δέσμη πρόληψης CLABSI',
    titleEl: 'Δέσμη πρόληψης CLABSI',
    titleEn: 'CLABSI Prevention Bundle',
    version: '1.0',
    status: 'published',
    scope: 'icu',
    source: 'WHO',
    sourceVersion: '2024',
    system: true,
    departments: [],
    rawElements: [
      {
        id: 'hand_hygiene',
        labelEl: 'Υγιεινή χεριών πριν την εισαγωγή',
        labelEn: 'Hand hygiene before insertion',
      },
      {
        id: 'barrier',
        labelEl: 'Μέγιστες προφυλάξεις φραγμού',
        labelEn: 'Maximal barrier precautions',
      },
      {
        id: 'skin_prep',
        labelEl: 'Αντισηψία δέρματος με χλωρεξιδίνη',
        labelEn: 'Chlorhexidine skin antisepsis',
      },
      {
        id: 'site_review',
        labelEl: 'Καθημερινή επανεκτίμηση σημείου εισόδου',
        labelEn: 'Daily insertion site review',
      },
    ],
  },
  {
    dbId: 'tmpl-vae',
    id: 'VAE',
    bundleKey: 'VAE',
    name: 'VAE Bundle',
    title: 'Δέσμη πρόληψης VAE',
    titleEl: 'Δέσμη πρόληψης VAE',
    titleEn: 'VAE Prevention Bundle',
    version: '1.0',
    status: 'published',
    scope: 'icu',
    source: 'WHO',
    sourceVersion: '2024',
    system: true,
    departments: [],
    rawElements: [
      {
        id: 'head_elevation',
        labelEl: 'Ανύψωση κεφαλής 30-45°',
        labelEn: 'Head-of-bed elevation 30–45°',
      },
      {
        id: 'oral_care',
        labelEl: 'Στοματική φροντίδα με χλωρεξιδίνη',
        labelEn: 'Chlorhexidine oral care',
      },
      {
        id: 'sedation_break',
        labelEl: 'Ημερήσια διακοπή καταστολής',
        labelEn: 'Daily sedation interruption',
      },
    ],
  },
  {
    dbId: 'tmpl-cauti',
    id: 'CAUTI',
    bundleKey: 'CAUTI',
    name: 'CAUTI Bundle',
    title: 'Δέσμη πρόληψης CAUTI',
    titleEl: 'Δέσμη πρόληψης CAUTI',
    titleEn: 'CAUTI Prevention Bundle',
    version: '1.0',
    status: 'published',
    scope: 'ward',
    source: 'WHO',
    sourceVersion: '2024',
    system: true,
    departments: [],
    rawElements: [
      {
        id: 'indication',
        labelEl: 'Τεκμηριωμένη ένδειξη ουροκαθετήρα',
        labelEn: 'Documented catheter indication',
      },
      {
        id: 'aseptic_insertion',
        labelEl: 'Άσηπτη τεχνική τοποθέτησης',
        labelEn: 'Aseptic insertion technique',
      },
      {
        id: 'closed_drainage',
        labelEl: 'Κλειστό σύστημα παροχέτευσης',
        labelEn: 'Closed drainage system',
      },
      {
        id: 'bag_below_bladder',
        labelEl: 'Ουροσυλλέκτης κάτω από το επίπεδο της κύστης',
        labelEn: 'Drainage bag below bladder level',
      },
      {
        id: 'daily_review',
        labelEl: 'Καθημερινή επανεκτίμηση ανάγκης',
        labelEn: 'Daily review of need',
      },
    ],
  },
  {
    dbId: 'tmpl-ssi',
    id: 'SSI',
    bundleKey: 'SSI',
    name: 'SSI Bundle',
    title: 'Δέσμη πρόληψης SSI',
    titleEl: 'Δέσμη πρόληψης SSI',
    titleEn: 'SSI Prevention Bundle',
    version: '1.0',
    status: 'published',
    scope: 'surgery',
    source: 'WHO',
    sourceVersion: '2024',
    system: true,
    departments: [],
    rawElements: [
      {
        id: 'preop_shower',
        labelEl: 'Προεγχειρητικό λουτρό',
        labelEn: 'Preoperative shower',
      },
      {
        id: 'hair_clipping',
        labelEl: 'Αποτρίχωση μόνο με κουρευτική μηχανή',
        labelEn: 'Hair removal by clipping only',
      },
      {
        id: 'prophylaxis_timing',
        labelEl: 'Προφύλαξη εντός 60 λεπτών πριν την τομή',
        labelEn: 'Prophylaxis within 60 minutes before incision',
      },
      {
        id: 'skin_antisepsis',
        labelEl: 'Αντισηψία δέρματος με αλκοολούχο χλωρεξιδίνη',
        labelEn: 'Alcohol-based chlorhexidine skin antisepsis',
      },
      {
        id: 'normothermia',
        labelEl: 'Διατήρηση νορμοθερμίας',
        labelEn: 'Perioperative normothermia',
      },
    ],
  },
].map(template => ({
  ...template,
  elements: template.rawElements.map(item => [item.id, item.labelEl]),
}))
