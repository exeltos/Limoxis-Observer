import { emptyInPreview } from '../../core/preview/emptyPreview'
import { shiftDemoDatesInPlace } from '../../core/data/demoClock'
import {
  DEMO_HISTORY_MONTHS,
  between,
  dayInMonth,
  demoMonthlyPatientDays,
  lastDayOfMonth,
  pad2,
  pick,
  seededRandom,
} from '../../core/data/demoSeed'
import { whoStatsFromObservations } from './whoHandHygieneStats'
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

function handHygieneRow({ id, date, department, profession, observer, startTime, endTime, items }) {
  const stats = whoStatsFromObservations(items)
  return {
    id,
    date,
    departmentEl: department.el,
    departmentEn: department.en,
    profession,
    observations: stats.opportunities,
    compliant: stats.compliant,
    rate: stats.compliance,
    observer,
    session: { department: department.el, date, observer, startTime, endTime },
    whoObservations: items,
    whoStats: stats,
    lifecycleStatus: 'active',
    createdAt: `${date}T${startTime}:00`,
    createdById: 'demo-user',
    updatedAt: `${date}T${endTime}:00`,
    updatedById: 'demo-user',
  }
}

export const handHygieneRows = [
  handHygieneRow({
    id: 'HH-2601',
    date: '2026-08-20',
    department: preventionDepartments[0],
    profession: 'nursing',
    observer: 'Ελένη Παπαδοπούλου',
    startTime: '09:00',
    endTime: '09:40',
    items: [
      {
        id: 'o1',
        professionalsCount: 1,
        professionalCategory: 'Νοσηλευτής / Νοσηλεύτρια',
        moments: ['moment1'],
        action: 'HR',
        gloves: false,
        notes: '',
      },
      {
        id: 'o2',
        professionalsCount: 1,
        professionalCategory: 'Νοσηλευτής / Νοσηλεύτρια',
        moments: ['moment4'],
        action: 'HR',
        gloves: true,
        notes: '',
      },
      {
        id: 'o3',
        professionalsCount: 1,
        professionalCategory: 'Νοσηλευτής / Νοσηλεύτρια',
        moments: ['moment2'],
        action: 'HW',
        gloves: false,
        notes: '',
      },
      {
        id: 'o4',
        professionalsCount: 1,
        professionalCategory: 'Νοσηλευτής / Νοσηλεύτρια',
        moments: ['moment3'],
        action: 'MISSED',
        gloves: false,
        notes: 'Διακοπή λόγω επείγοντος',
      },
    ],
  }),
  handHygieneRow({
    id: 'HH-2602',
    date: '2026-08-25',
    department: preventionDepartments[1],
    profession: 'medical',
    observer: 'Νικόλαος Δημητρίου',
    startTime: '11:15',
    endTime: '11:45',
    items: [
      {
        id: 'o1',
        professionalsCount: 1,
        professionalCategory: 'Ιατρός',
        moments: ['moment1'],
        action: 'HR',
        gloves: false,
        notes: '',
      },
      {
        id: 'o2',
        professionalsCount: 1,
        professionalCategory: 'Ιατρός',
        moments: ['moment4'],
        action: 'HR',
        gloves: false,
        notes: '',
      },
      {
        id: 'o3',
        professionalsCount: 1,
        professionalCategory: 'Ιατρός',
        moments: ['moment5'],
        action: 'HR',
        gloves: false,
        notes: '',
      },
    ],
  }),
  handHygieneRow({
    id: 'HH-2603',
    date: '2026-08-28',
    department: preventionDepartments[0],
    profession: 'nursing',
    observer: 'Ελένη Παπαδοπούλου',
    startTime: '14:00',
    endTime: '14:30',
    items: [
      {
        id: 'o1',
        professionalsCount: 1,
        professionalCategory: 'Νοσηλευτής / Νοσηλεύτρια',
        moments: ['moment2'],
        action: 'HW',
        gloves: true,
        notes: '',
      },
      {
        id: 'o2',
        professionalsCount: 1,
        professionalCategory: 'Νοσηλευτής / Νοσηλεύτρια',
        moments: ['moment3'],
        action: 'HW',
        gloves: true,
        notes: '',
      },
    ],
  }),
  handHygieneRow({
    id: 'HH-2604',
    date: '2026-07-15',
    department: preventionDepartments[2],
    profession: 'nursing',
    observer: 'Ελένη Κωνσταντίνου',
    startTime: '10:00',
    endTime: '10:35',
    items: [
      {
        id: 'o1',
        professionalsCount: 2,
        professionalCategory: 'Νοσηλευτής / Νοσηλεύτρια',
        moments: ['moment1'],
        action: 'HR',
        gloves: false,
        notes: '',
      },
      {
        id: 'o2',
        professionalsCount: 1,
        professionalCategory: 'Νοσηλευτής / Νοσηλεύτρια',
        moments: ['moment2'],
        action: 'MISSED',
        gloves: true,
        notes: '',
      },
      {
        id: 'o3',
        professionalsCount: 2,
        professionalCategory: 'Νοσηλευτής / Νοσηλεύτρια',
        moments: ['moment4'],
        action: 'HR',
        gloves: false,
        notes: '',
      },
    ],
  }),
  handHygieneRow({
    id: 'HH-2605',
    date: '2026-06-18',
    department: preventionDepartments[3],
    profession: 'medical',
    observer: 'Μαρία Κωνσταντίνου',
    startTime: '12:00',
    endTime: '12:30',
    items: [
      {
        id: 'o1',
        professionalsCount: 2,
        professionalCategory: 'Ιατρός',
        moments: ['moment1'],
        action: 'HR',
        gloves: false,
        notes: '',
      },
      {
        id: 'o2',
        professionalsCount: 1,
        professionalCategory: 'Ιατρός',
        moments: ['moment3'],
        action: 'HW',
        gloves: true,
        notes: '',
      },
      {
        id: 'o3',
        professionalsCount: 1,
        professionalCategory: 'Ιατρός',
        moments: ['moment5'],
        action: 'MISSED',
        gloves: false,
        notes: '',
      },
    ],
  }),
  handHygieneRow({
    id: 'HH-2606',
    date: '2026-05-20',
    department: preventionDepartments[4],
    profession: 'nursing',
    observer: 'Ελένη Παπαδοπούλου',
    startTime: '09:20',
    endTime: '09:50',
    items: [
      {
        id: 'o1',
        professionalsCount: 2,
        professionalCategory: 'Νοσηλευτής / Νοσηλεύτρια',
        moments: ['moment1'],
        action: 'HR',
        gloves: false,
        notes: '',
      },
      {
        id: 'o2',
        professionalsCount: 2,
        professionalCategory: 'Νοσηλευτής / Νοσηλεύτρια',
        moments: ['moment4'],
        action: 'HR',
        gloves: false,
        notes: '',
      },
    ],
  }),
]

function wasteRow({
  id,
  periodStart,
  periodEnd,
  department,
  type,
  weight,
  containers,
  patientDays,
  responsible,
  documentNumber,
  collectionCompany,
}) {
  return {
    id,
    date: periodEnd,
    periodStart,
    periodEnd,
    period: periodStart === periodEnd ? periodStart : `${periodStart} – ${periodEnd}`,
    departmentEl: department.el,
    departmentEn: department.en,
    wasteType: type.el,
    type: type.el,
    typeEn: type.en,
    wasteTypeId: type.id,
    weight,
    containers,
    patientDays: patientDays || null,
    patientDaysSource: patientDays ? 'manual' : '',
    indicator: patientDays ? Number(((weight / patientDays) * 1000).toFixed(2)) : null,
    responsible,
    documentNumber,
    collectionCompany,
    notes: '',
    status: 'completed',
    lifecycleStatus: 'active',
    createdAt: `${periodEnd}T08:00:00`,
    createdById: 'demo-user',
    updatedAt: `${periodEnd}T08:00:00`,
    updatedById: 'demo-user',
  }
}

export const wasteRows = [
  wasteRow({
    id: 'WST-2601',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    department: preventionDepartments[0],
    type: wasteTypeLibrary[0],
    weight: 184.5,
    containers: 12,
    patientDays: 620,
    responsible: 'Γεώργιος Αντωνίου',
    documentNumber: 'ΤΠ-1042',
    collectionCompany: 'EcoBio Α.Ε.',
  }),
  wasteRow({
    id: 'WST-2602',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    department: preventionDepartments[2],
    type: wasteTypeLibrary[1],
    weight: 22.3,
    containers: 4,
    patientDays: 410,
    responsible: 'Γεώργιος Αντωνίου',
    documentNumber: 'ΤΠ-1043',
    collectionCompany: 'EcoBio Α.Ε.',
  }),
  wasteRow({
    id: 'WST-2603',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-28',
    department: preventionDepartments[0],
    type: wasteTypeLibrary[2],
    weight: 9.8,
    containers: 2,
    patientDays: null,
    responsible: 'Γεώργιος Αντωνίου',
    documentNumber: 'ΤΠ-1055',
    collectionCompany: 'EcoBio Α.Ε.',
  }),
]

function antisepticRow({
  id,
  periodStart,
  periodEnd,
  department,
  product,
  litres,
  patientDays,
  method,
  referenceNumber,
  responsible,
}) {
  const eligible = Boolean(product.metadata?.is_abhr)
  return {
    id,
    period: periodStart.slice(0, 7),
    periodStart,
    periodEnd,
    departmentEl: department.el,
    departmentEn: department.en,
    product: product.el,
    productEn: product.en,
    antisepticItemId: product.id,
    productCode: product.code,
    litres,
    patientDays: patientDays || null,
    patientDaysSource: patientDays ? 'manual' : '',
    indicator: eligible && patientDays ? Number(((litres / patientDays) * 1000).toFixed(2)) : null,
    indicatorEligible: eligible,
    method,
    referenceNumber,
    responsible,
    notes: '',
    lifecycleStatus: 'active',
    createdAt: `${periodEnd}T08:00:00`,
    createdById: 'demo-user',
    updatedAt: `${periodEnd}T08:00:00`,
    updatedById: 'demo-user',
  }
}

export const antisepticRows = [
  antisepticRow({
    id: 'ANT-2601',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    department: preventionDepartments[0],
    product: antisepticLibrary[0],
    litres: 41.2,
    patientDays: 620,
    method: 'direct_measurement',
    referenceNumber: 'ΔΤ-330',
    responsible: 'Ελένη Παπαδοπούλου',
  }),
  antisepticRow({
    id: 'ANT-2602',
    periodStart: '2026-07-01',
    periodEnd: '2026-07-31',
    department: preventionDepartments[1],
    product: antisepticLibrary[0],
    litres: 18.6,
    patientDays: 505,
    method: 'direct_measurement',
    referenceNumber: 'ΔΤ-331',
    responsible: 'Νικόλαος Δημητρίου',
  }),
  antisepticRow({
    id: 'ANT-2603',
    periodStart: '2026-08-01',
    periodEnd: '2026-08-28',
    department: preventionDepartments[2],
    product: antisepticLibrary[1],
    litres: 6.4,
    patientDays: null,
    method: 'direct_measurement',
    referenceNumber: 'ΔΤ-340',
    responsible: 'Ελένη Κωνσταντίνου',
  }),
]

function bundleAssessmentRow({ id, template, department, date, answers, shift, context, owner, links = {} }) {
  const elementIds = template.rawElements.map(item => item.id)
  const applicable = elementIds
    .map(itemId => answers[itemId])
    .filter(x => x === 'yes' || x === 'no')
  const yes = applicable.filter(x => x === 'yes').length
  const score = applicable.length ? Math.round((yes / applicable.length) * 100) : null
  const failedCount = applicable.length - yes
  const findings = template.rawElements
    .filter(item => answers[item.id] === 'no')
    .map(item => ({ id: item.id, label: item.labelEl, note: '' }))
  return {
    id,
    bundle: template.bundleKey,
    templateId: template.bundleKey,
    templateName: template.name,
    templateTitle: template.titleEl,
    templateVersion: template.version,
    templateSource: template.source,
    templateSnapshot: template,
    departmentId: department.el,
    departmentEl: department.el,
    departmentEn: department.en,
    date,
    period: date,
    score,
    answers,
    answerNotes: {},
    shift,
    context,
    patientId: '',
    patientRef: '',
    deviceId: '',
    deviceRef: '',
    generalNotes: '',
    applicableCount: applicable.length,
    failedCount,
    allOrNone: applicable.length > 0 && failedCount === 0,
    findings,
    owner,
    status: 'completed',
    lifecycleStatus: 'active',
    createdAt: `${date}T10:00:00`,
    createdById: 'demo-user',
    updatedAt: `${date}T10:00:00`,
    updatedById: 'demo-user',
    ...links,
  }
}

export const bundleRows = [
  // Checks made from the devices of three demo episodes (the episode forms tab).
  bundleAssessmentRow({
    id: 'BND-2610',
    template: bundleTemplateLibrary[0],
    department: preventionDepartments[0],
    date: '2026-08-28',
    shift: 'Πρωινή',
    context: 'Κεντρικός φλεβικός καθετήρας',
    owner: 'Ελένη Παπαδοπούλου',
    answers: { hand_hygiene: 'yes', barrier: 'yes', skin_prep: 'yes', site_review: 'no' },
    links: { surveillanceCaseId: 'SUR-260041', surveillanceDeviceId: 'DEV-26011', patientRecordId: 'PT-260184', deviceDay: 8 },
  }),
  bundleAssessmentRow({
    id: 'BND-2611',
    template: bundleTemplateLibrary[2],
    department: preventionDepartments[0],
    date: '2026-08-29',
    shift: 'Πρωινή',
    context: 'Ουροκαθετήρας',
    owner: 'Νικόλαος Δημητρίου',
    answers: { indication: 'yes', aseptic_insertion: 'yes', closed_drainage: 'yes', bag_below_bladder: 'yes', daily_review: 'yes' },
    links: { surveillanceCaseId: 'SUR-260039', surveillanceDeviceId: 'DEV-26012', deviceDay: 7 },
  }),
  bundleAssessmentRow({
    id: 'BND-2612',
    template: bundleTemplateLibrary[1],
    department: preventionDepartments[0],
    date: '2026-08-27',
    shift: 'Νυχτερινή',
    context: 'Μηχανικός αερισμός',
    owner: 'Ελένη Κωνσταντίνου',
    answers: { head_elevation: 'yes', oral_care: 'yes', sedation_break: 'no' },
    links: { surveillanceCaseId: 'SUR-260036', surveillanceDeviceId: 'DEV-26013', deviceDay: 9 },
  }),
  bundleAssessmentRow({
    id: 'BND-2601',
    template: bundleTemplateLibrary[0],
    department: preventionDepartments[0],
    date: '2026-08-22',
    shift: 'morning',
    context: 'Κεντρικός φλεβικός καθετήρας',
    owner: 'Ελένη Παπαδοπούλου',
    answers: { hand_hygiene: 'yes', barrier: 'yes', skin_prep: 'yes', site_review: 'yes' },
  }),
  bundleAssessmentRow({
    id: 'BND-2602',
    template: bundleTemplateLibrary[1],
    department: preventionDepartments[0],
    date: '2026-08-27',
    shift: 'night',
    context: 'Μηχανικός αερισμός',
    owner: 'Νικόλαος Δημητρίου',
    answers: { head_elevation: 'yes', oral_care: 'no', sedation_break: 'yes' },
  }),
  bundleAssessmentRow({
    id: 'BND-2603',
    template: bundleTemplateLibrary[0],
    department: preventionDepartments[2],
    date: '2026-08-28',
    shift: 'morning',
    context: 'Κεντρικός φλεβικός καθετήρας',
    owner: 'Ελένη Κωνσταντίνου',
    answers: { hand_hygiene: 'yes', barrier: 'na', skin_prep: 'yes', site_review: 'yes' },
  }),
]

// A year of history behind the recent rows above (authored 2025-09 … 2026-08):
// observation sessions in every ward with a slowly improving compliance, monthly
// waste and antiseptic consumption, and bundle audits in the high-risk units.
const HH_OBSERVERS = [
  'Ελένη Παπαδοπούλου',
  'Νικόλαος Δημητρίου',
  'Ελένη Κωνσταντίνου',
  'Μαρία Κωνσταντίνου',
  'Δήμητρα Σταθάτου',
]
const WARD_COMPLIANCE = [0.02, -0.04, 0, -0.06, 0.03, 0.05, -0.02]
const NURSING_CATEGORIES = [
  'Νοσηλευτής / Νοσηλεύτρια',
  'Νοσηλευτής / Νοσηλεύτρια',
  'Νοσηλευτής / Νοσηλεύτρια',
  'Βοηθός Νοσηλευτή',
  'Βοηθητικό προσωπικό',
]
const MEDICAL_CATEGORIES = ['Ιατρός', 'Ιατρός', 'Ιατρός', 'Φυσικοθεραπευτής', 'Τεχνολόγος']
const MOMENTS = ['moment1', 'moment1', 'moment2', 'moment3', 'moment4', 'moment4', 'moment5']

DEMO_HISTORY_MONTHS.forEach((month, monthIndex) => {
  const sessions = month === '2026-08' ? 1 : 3
  for (let slot = 0; slot < sessions; slot++) {
    const rand = seededRandom(`hh|${month}|${slot}`)
    const wardIndex = (monthIndex * 3 + slot) % preventionDepartments.length
    const profession = (monthIndex + slot) % 3 === 2 ? 'medical' : 'nursing'
    const count = between(rand, 8, 14)
    const rate = Math.min(
      0.93,
      Math.max(
        0.66,
        0.71 + monthIndex * 0.014 + WARD_COMPLIANCE[wardIndex] + (rand() - 0.5) * 0.06,
      ),
    )
    const compliantCount = Math.round(count * rate)
    const missedAt = new Set()
    while (missedAt.size < count - compliantCount) missedAt.add(between(rand, 0, count - 1))
    const categories = profession === 'medical' ? MEDICAL_CATEGORIES : NURSING_CATEGORIES
    const items = Array.from({ length: count }, (_, index) => ({
      id: `o${index + 1}`,
      professionalsCount: 1,
      professionalCategory: pick(rand, categories),
      moments: [pick(rand, MOMENTS)],
      action: missedAt.has(index) ? 'MISSED' : rand() < 0.82 ? 'HR' : 'HW',
      gloves: rand() < 0.25,
      notes: '',
    }))
    const hour = between(rand, 8, 13)
    handHygieneRows.push(
      handHygieneRow({
        id: `HH-${month.replace('-', '').slice(2)}-${slot + 1}`,
        date: dayInMonth(month, 3 + slot * 9 + between(rand, 0, 4)),
        department: preventionDepartments[wardIndex],
        profession,
        observer: HH_OBSERVERS[(monthIndex + slot) % HH_OBSERVERS.length],
        startTime: `${pad2(hour)}:00`,
        endTime: `${pad2(hour)}:40`,
        items,
      }),
    )
  }
})

const monthPeriod = month => [`${month}-01`, `${month}-${pad2(lastDayOfMonth(month))}`]
const hasMonthlyRow = (rows, department, key, value, month) =>
  rows.some(
    row =>
      row.departmentEl === department.el && row[key] === value && row.periodStart.startsWith(month),
  )
let wasteDocument = 900
DEMO_HISTORY_MONTHS.forEach(month => {
  const [periodStart, periodEnd] = monthPeriod(month)
  preventionDepartments.forEach((department, wardIndex) => {
    const patientDays = demoMonthlyPatientDays(department.el, month)
    const types = ['dep-icu', 'dep-surgery', 'dep-ed'].includes(department.id)
      ? [wasteTypeLibrary[0], wasteTypeLibrary[1]]
      : [wasteTypeLibrary[0]]
    for (const type of types) {
      if (hasMonthlyRow(wasteRows, department, 'wasteTypeId', type.id, month)) continue
      const rand = seededRandom(`waste|${month}|${department.id}|${type.id}`)
      const perThousand =
        type.id === 'wt-sharps'
          ? 30 + rand() * 18
          : (department.id === 'dep-icu' ? 290 : 190) + rand() * 60
      const weight = Number(((perThousand * patientDays) / 1000).toFixed(1))
      wasteDocument += 1
      wasteRows.push(
        wasteRow({
          id: `WST-${month.replace('-', '').slice(2)}-${wardIndex + 1}${type.id === 'wt-sharps' ? 'S' : 'I'}`,
          periodStart,
          periodEnd,
          department,
          type,
          weight,
          containers: Math.max(1, Math.round(weight / (type.id === 'wt-sharps' ? 5 : 15))),
          patientDays,
          responsible: 'Γεώργιος Αντωνίου',
          documentNumber: `ΤΠ-${wasteDocument}`,
          collectionCompany: 'EcoBio Α.Ε.',
        }),
      )
    }
  })
})

let antisepticReference = 200
DEMO_HISTORY_MONTHS.forEach((month, monthIndex) => {
  const [periodStart, periodEnd] = monthPeriod(month)
  preventionDepartments.forEach((department, wardIndex) => {
    const patientDays = demoMonthlyPatientDays(department.el, month)
    const products = ['dep-surgery', 'dep-ortho'].includes(department.id)
      ? antisepticLibrary
      : [antisepticLibrary[0]]
    for (const product of products) {
      if (hasMonthlyRow(antisepticRows, department, 'antisepticItemId', product.id, month)) continue
      const rand = seededRandom(`antiseptic|${month}|${department.id}|${product.id}`)
      const perThousand = product.metadata?.is_abhr
        ? (department.id === 'dep-icu' ? 58 : 26) + monthIndex * 0.9 + rand() * 6
        : 12 + rand() * 6
      antisepticReference += 1
      antisepticRows.push(
        antisepticRow({
          id: `ANT-${month.replace('-', '').slice(2)}-${wardIndex + 1}${product.metadata?.is_abhr ? 'A' : 'S'}`,
          periodStart,
          periodEnd,
          department,
          product,
          litres: Number(((perThousand * patientDays) / 1000).toFixed(1)),
          patientDays,
          method: 'direct_measurement',
          referenceNumber: `ΔΤ-${antisepticReference}`,
          responsible: HH_OBSERVERS[wardIndex % HH_OBSERVERS.length],
        }),
      )
    }
  })
})

const [clabsi, vae, cauti, ssi] = bundleTemplateLibrary
const ward = id => preventionDepartments.find(department => department.id === id)
const BUNDLE_PLAN = [
  [clabsi, 'dep-icu', 'Κεντρικός φλεβικός καθετήρας', 6],
  [vae, 'dep-icu', 'Μηχανικός αερισμός', 12],
  [cauti, 'dep-icu', 'Ουροκαθετήρας', 17],
  [cauti, 'dep-internal', 'Ουροκαθετήρας', 20],
  [ssi, 'dep-surgery', 'Χειρουργική επέμβαση', 9],
]
const BUNDLE_EXTRA = [
  [clabsi, 'dep-surgery', 'Κεντρικός φλεβικός καθετήρας', 23],
  [ssi, 'dep-ortho', 'Χειρουργική επέμβαση', 14],
  [clabsi, 'dep-nicu', 'Κεντρικός φλεβικός καθετήρας', 25],
]
DEMO_HISTORY_MONTHS.forEach((month, monthIndex) => {
  const plan = [...BUNDLE_PLAN, BUNDLE_EXTRA[monthIndex % BUNDLE_EXTRA.length]]
  plan.forEach(([template, departmentId, context, day], index) => {
    if (month === '2026-08' && day > 20) return
    const rand = seededRandom(`bundle|${month}|${index}`)
    const reliability = 0.84 + monthIndex * 0.009
    const answers = Object.fromEntries(
      template.rawElements.map(item => [
        item.id,
        rand() < 0.05 ? 'na' : rand() < reliability ? 'yes' : 'no',
      ]),
    )
    bundleRows.push(
      bundleAssessmentRow({
        id: `BND-${month.replace('-', '').slice(2)}-${index + 1}`,
        template,
        department: ward(departmentId),
        date: dayInMonth(month, day),
        shift: ['morning', 'afternoon', 'night'][(monthIndex + index) % 3],
        context,
        owner: HH_OBSERVERS[(monthIndex + index) % HH_OBSERVERS.length],
        answers,
      }),
    )
  })
})

// Dates follow today (src/core/data/demoClock.js).
shiftDemoDatesInPlace([handHygieneRows, wasteRows, antisepticRows, bundleRows])
// Empty-hospital preview (?helpEmpty=1): no sample records.
emptyInPreview(handHygieneRows)
emptyInPreview(wasteRows)
emptyInPreview(antisepticRows)
emptyInPreview(bundleRows)
