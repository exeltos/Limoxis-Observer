import { surveillanceDemoData } from './surveillanceDemoData'
export const clinicalCases = {
  'SUR-260041': {
    id:'SUR-260041', patientId:'PT-260184', patient:'Ελένη Παπαδοπούλου', patientEn:'Eleni Papadopoulou', dateOfBirth:'1958-04-11', department:'ΜΕΘ', departmentEn:'ICU', room:'ICU-07', admissionDate:'2026-08-24', startedAt:'2026-08-24', reviewDue:'2026-08-27', status:'active', organism:'Klebsiella pneumoniae', resistance:'MDR', source:'Αίμα', sourceEn:'Blood',
    haiClassification:{status:'confirmed',type:'bloodstreamInfection',definitionSet:'WHO HAI surveillance',criteriaMet:true,rationale:'Συμβατή κλινική και μικροβιολογική εικόνα για λοίμωξη αιματικής ροής σχετιζόμενη με παροχή φροντίδας.',rationaleEn:'Clinical and microbiological picture compatible with a healthcare-associated bloodstream infection.'},
    devices:[{id:'DEV-26011',name:'Κεντρικός φλεβικός καθετήρας',nameEn:'Central venous catheter',insertedAt:'2026-08-22',site:'Δεξιά έσω σφαγίτιδα',siteEn:'Right internal jugular',reviewDue:'2026-08-27',indication:'Αγγειοδραστική υποστήριξη',indicationEn:'Vasoactive support',status:'active'}],
    assessment:{ date:'2026-08-24', type:'healthcareAssociated', classification:'infection', assessedBy:'Α. Νικολάου', summary:'Πυρετός και αιμοδυναμική επιβάρυνση μετά την εισαγωγή στη ΜΕΘ.', summaryEn:'Fever and haemodynamic deterioration after ICU admission.', symptoms:['Πυρετός >38°C','Υπόταση'], symptomsEn:['Fever >38°C','Hypotension'], riskFactors:['Κεντρικός φλεβικός καθετήρας','Πρόσφατη αντιμικροβιακή αγωγή'], riskFactorsEn:['Central venous catheter','Recent antimicrobial therapy'] },
    samples:[
      { id:'LAB-260771', type:'bloodCulture', collectedAt:'2026-08-24T08:25:00', resultedAt:'2026-08-25T11:40:00', result:'positive', organism:'Klebsiella pneumoniae', resistance:'MDR', susceptibility:'Meropenem R · Colistin S · Ceftazidime/avibactam S', critical:true, communicatedAt:'2026-08-25T11:48:00' },
      { id:'LAB-260779', type:'bloodCulture', collectedAt:'2026-08-26T09:10:00', resultedAt:null, result:'pending', organism:null, resistance:null, susceptibility:null, critical:false, communicatedAt:null },
    ],
    therapy:[{ id:'TX-260188', antimicrobial:'Ceftazidime/avibactam', dose:'2.5 g', route:'IV', startedAt:'2026-08-25', plannedEnd:'2026-09-01', indication:'MDR Klebsiella bacteraemia', approved:true }],
    isolation:{ id:'ISO-260102', precautions:['contactPrecautions'], room:'ICU-07', startedAt:'2026-08-25T12:10:00', reason:'MDR Klebsiella pneumoniae', nextReview:'2026-08-27', status:'active' },
    reassessments:[{ id:'REV-260044', date:'2026-08-26', status:'clinicalImprovement', decision:'continueIsolation', notes:'Αιμοδυναμικά σταθερότερη. Αναμένεται επαναληπτική αιμοκαλλιέργεια.', notesEn:'Haemodynamically more stable. Repeat blood culture pending.', by:'Δ. Παπαδάκη' }],
    outcome:null,
    timeline:[
      {at:'2026-08-26T13:20:00', type:'reassessment', actor:'Δ. Παπαδάκη', detail:'clinicalImprovement'},
      {at:'2026-08-25T12:10:00', type:'isolation', actor:'Α. Νικολάου', detail:'contactPrecautions'},
      {at:'2026-08-25T11:48:00', type:'samples', actor:'Μικροβιολογικό', actorEn:'Microbiology Laboratory', detail:'criticalResult'},
      {at:'2026-08-24T10:05:00', type:'clinicalAssessment', actor:'Α. Νικολάου', detail:'completed'},
    ],
  },
  'SUR-260039': {
    id:'SUR-260039', patientId:'PT-260179', patient:'Νικόλαος Γεωργίου', patientEn:'Nikolaos Georgiou', dateOfBirth:'1949-09-02', department:'Παθολογική', departmentEn:'Internal Medicine', room:'IM-214', admissionDate:'2026-08-21', startedAt:'2026-08-25', reviewDue:'2026-08-29', status:'active', organism:'Escherichia coli', resistance:null, source:'Ούρα', sourceEn:'Urine',
    haiClassification:{status:'suspected',type:'urinaryTractInfection',definitionSet:'WHO HAI surveillance',criteriaMet:false,rationale:'Η αξιολόγηση παραμένει ανοικτή έως την ολοκλήρωση των κριτηρίων επιτήρησης.',rationaleEn:'Assessment remains open until surveillance criteria are completed.'},
    devices:[{id:'DEV-26012',name:'Ουροκαθετήρας',nameEn:'Urinary catheter',insertedAt:'2026-08-23',site:'Ουροποιητικό',siteEn:'Urinary tract',reviewDue:'2026-08-28',indication:'Παρακολούθηση διούρησης',indicationEn:'Urine output monitoring',status:'active'}],
    assessment:{ date:'2026-08-25', type:'suspected', classification:'infection', assessedBy:'Μ. Αντωνίου', summary:'Πυρετός και δυσουρία με θετική γενική ούρων.', summaryEn:'Fever and dysuria with abnormal urinalysis.', symptoms:['Πυρετός','Δυσουρία'], symptomsEn:['Fever','Dysuria'], riskFactors:['Ουροκαθετήρας'], riskFactorsEn:['Urinary catheter'] },
    samples:[{ id:'LAB-260760', type:'urineCulture', collectedAt:'2026-08-25T07:55:00', resultedAt:'2026-08-26T14:10:00', result:'positive', organism:'Escherichia coli', resistance:null, susceptibility:'Ceftriaxone S · Ciprofloxacin R', critical:false, communicatedAt:null }],
    therapy:[], isolation:null, reassessments:[], outcome:null,
    timeline:[{at:'2026-08-26T14:10:00',type:'samples',actor:'Μικροβιολογικό',actorEn:'Microbiology Laboratory',detail:'positive'},{at:'2026-08-25T09:30:00',type:'clinicalAssessment',actor:'Μ. Αντωνίου',detail:'completed'}],
  },
  'SUR-260036': {
    id:'SUR-260036', patientId:'PT-260155', patient:'Αλέξανδρος Δημητρίου', patientEn:'Alexandros Dimitriou', dateOfBirth:'1966-01-23', department:'ΜΕΘ', departmentEn:'ICU', room:'ICU-03', admissionDate:'2026-08-19', startedAt:'2026-08-22', reviewDue:'2026-08-28', status:'active', organism:'Acinetobacter baumannii', resistance:'XDR', source:'Αναπνευστικό', sourceEn:'Respiratory',
    haiClassification:{status:'confirmed',type:'ventilatorAssociatedPneumonia',definitionSet:'WHO HAI surveillance',criteriaMet:true,rationale:'Κλινικά και μικροβιολογικά ευρήματα συμβατά με πνευμονία σχετιζόμενη με μηχανικό αερισμό.',rationaleEn:'Clinical and microbiological findings compatible with ventilator-associated pneumonia.'},
    devices:[{id:'DEV-26013',name:'Ενδοτραχειακός σωλήνας',nameEn:'Endotracheal tube',insertedAt:'2026-08-19',site:'Αεραγωγός',siteEn:'Airway',reviewDue:'2026-08-28',indication:'Μηχανικός αερισμός',indicationEn:'Mechanical ventilation',status:'active'}],
    assessment:{ date:'2026-08-22', type:'healthcareAssociated', classification:'infection', assessedBy:'Δ. Παπαδάκη', summary:'Κλινική εικόνα συμβατή με πνευμονία σχετιζόμενη με μηχανικό αερισμό.', summaryEn:'Clinical picture compatible with ventilator-associated pneumonia.', symptoms:['Πυρετός','Πυώδεις εκκρίσεις'], symptomsEn:['Fever','Purulent secretions'], riskFactors:['Μηχανικός αερισμός','Παρατεταμένη νοσηλεία ΜΕΘ'], riskFactorsEn:['Mechanical ventilation','Prolonged ICU stay'] },
    samples:[{ id:'LAB-260734', type:'respiratorySample', collectedAt:'2026-08-22T06:40:00', resultedAt:'2026-08-23T12:20:00', result:'positive', organism:'Acinetobacter baumannii', resistance:'XDR', susceptibility:'Colistin S · Tigecycline I · Carbapenems R', critical:true, communicatedAt:'2026-08-23T12:27:00' }],
    therapy:[{ id:'TX-260172', antimicrobial:'Colistin', dose:'κατά πρωτόκολλο', route:'IV', startedAt:'2026-08-23', plannedEnd:'2026-09-02', indication:'XDR A. baumannii VAP', approved:true }],
    isolation:{ id:'ISO-260096', precautions:['contactPrecautions'], room:'ICU-03', startedAt:'2026-08-23T12:35:00', reason:'XDR Acinetobacter baumannii', nextReview:'2026-08-28', status:'active' },
    reassessments:[{id:'REV-260040',date:'2026-08-27',status:'clinicalImprovement',decision:'continueIsolation',notes:'Σταδιακή κλινική βελτίωση.',notesEn:'Gradual clinical improvement.',by:'Δ. Παπαδάκη'}], outcome:null,
    timeline:[{at:'2026-08-27T10:15:00',type:'reassessment',actor:'Δ. Παπαδάκη',detail:'clinicalImprovement'},{at:'2026-08-23T12:35:00',type:'isolation',actor:'Δ. Παπαδάκη',detail:'contactPrecautions'},{at:'2026-08-23T12:27:00',type:'samples',actor:'Μικροβιολογικό',actorEn:'Microbiology Laboratory',detail:'criticalResult'},{at:'2026-08-22T08:20:00',type:'clinicalAssessment',actor:'Δ. Παπαδάκη',detail:'completed'}],
  },
  'SUR-250118': {
    id:'SUR-250118', patientId:'PT-260184', patient:'Ελένη Παπαδοπούλου', patientEn:'Eleni Papadopoulou', dateOfBirth:'1958-04-11', department:'Παθολογική', departmentEn:'Internal Medicine', room:'IM-108', admissionDate:'2025-11-03', startedAt:'2025-11-05', reviewDue:'2025-11-12', completedAt:'2025-11-13', status:'completed', organism:'Escherichia coli', resistance:null, source:'Ούρα', sourceEn:'Urine',
    haiClassification:{status:'confirmed',type:'urinaryTractInfection',definitionSet:'WHO HAI surveillance',criteriaMet:true,rationale:'Ολοκληρωμένη αξιολόγηση συμβατή με ουρολοίμωξη σχετιζόμενη με παροχή φροντίδας.',rationaleEn:'Completed assessment compatible with healthcare-associated urinary tract infection.'},
    devices:[],
    assessment:{date:'2025-11-05',type:'healthcareAssociated',classification:'infection',assessedBy:'Α. Νικολάου',summary:'Πυρετός και δυσουρία.',summaryEn:'Fever and dysuria.',symptoms:['Πυρετός','Δυσουρία'],symptomsEn:['Fever','Dysuria'],riskFactors:['Πρόσφατη αντιμικροβιακή αγωγή'],riskFactorsEn:['Recent antimicrobial therapy']},
    samples:[{id:'LAB-250411',type:'urineCulture',collectedAt:'2025-11-05T08:20:00',resultedAt:'2025-11-06T13:15:00',result:'positive',organism:'Escherichia coli',resistance:null,susceptibility:'Ceftriaxone S · Ciprofloxacin R',critical:false,communicatedAt:null}],
    therapy:[{id:'TX-250081',antimicrobial:'Ceftriaxone',dose:'2 g',route:'IV',startedAt:'2025-11-06',plannedEnd:'2025-11-12',indication:'HAI UTI',approved:true}],
    isolation:null,
    reassessments:[{id:'REV-250029',date:'2025-11-10',status:'clinicalImprovement',decision:'continueTreatment',notes:'Απύρετη, σαφής κλινική βελτίωση.',notesEn:'Afebrile with clear clinical improvement.',by:'Α. Νικολάου'}],
    outcome:{status:'resolved',date:'2025-11-13',notes:'Ολοκλήρωση αγωγής και κλείσιμο επιτήρησης.',notesEn:'Treatment completed and surveillance episode closed.'},
    timeline:[
      {at:'2025-11-13T11:00:00',type:'outcome',actor:'Α. Νικολάου',detail:'resolved'},
      {at:'2025-11-10T10:10:00',type:'reassessment',actor:'Α. Νικολάου',detail:'clinicalImprovement'},
      {at:'2025-11-06T13:15:00',type:'samples',actor:'Μικροβιολογικό',actorEn:'Microbiology Laboratory',detail:'positive'},
      {at:'2025-11-05T09:05:00',type:'clinicalAssessment',actor:'Α. Νικολάου',detail:'completed'},
    ],
  },

  'SUR-260018': {id:'SUR-260018',patientId:'PT-260115',patient:'Δημήτριος Οικονόμου',patientEn:'Dimitrios Oikonomou',department:'ΜΕΘ',departmentEn:'ICU',room:'ICU-05',admissionDate:'2026-04-03',startedAt:'2026-04-06',reviewDue:'2026-04-09',completedAt:'2026-04-17',status:'completed',organism:'Acinetobacter baumannii',resistance:'XDR',source:'Αίμα',sourceEn:'Blood',haiClassification:{status:'confirmed',type:'bloodstreamInfection',criteriaMet:true},devices:[{id:'DEV-018',name:'Κεντρικός φλεβικός καθετήρας',nameEn:'Central venous catheter',insertedAt:'2026-04-03',status:'removed',removedAt:'2026-04-12'}],assessment:{date:'2026-04-06',type:'healthcareAssociated',classification:'infection',assessedBy:'Demo IPC',summary:'Πυρετός με θετική αιμοκαλλιέργεια.',symptoms:['Πυρετός'],riskFactors:['Κεντρικός φλεβικός καθετήρας']},samples:[{id:'LAB-260406-002',type:'bloodCulture',collectedAt:'2026-04-06T05:20:00',resultedAt:'2026-04-07T05:10:00',result:'positive',organism:'Acinetobacter baumannii',resistance:'XDR',critical:true,communicatedAt:'2026-04-07T05:30:00'}],therapy:[{id:'TX-018',antimicrobial:'Colistin',dose:'κατά πρωτόκολλο',route:'IV',startedAt:'2026-04-07',plannedEnd:'2026-04-16',endedAt:'2026-04-16',status:'completed',approved:true}],isolation:{id:'ISO-018',precautions:['contactPrecautions'],startedAt:'2026-04-07',endedAt:'2026-04-17',reason:'XDR Acinetobacter',status:'ended'},reassessments:[{id:'REV-018',date:'2026-04-12',status:'clinicalImprovement',decision:'continueTreatment',notes:'Κλινική βελτίωση.',by:'Demo IPC'}],outcome:{status:'resolved',date:'2026-04-17',notes:'Ολοκλήρωση αγωγής.'},timeline:[]},
  'SUR-260023': {id:'SUR-260023',patientId:'PT-260126',patient:'Άννα Νικολάου',patientEn:'Anna Nikolaou',department:'Παθολογική',departmentEn:'Internal Medicine',room:'IM-204',admissionDate:'2026-05-16',startedAt:'2026-05-18',reviewDue:'2026-05-21',completedAt:'2026-05-23',status:'completed',organism:'Escherichia coli',resistance:'ESBL',source:'Ούρα',sourceEn:'Urine',haiClassification:{status:'confirmed',type:'urinaryTractInfection',criteriaMet:true},devices:[],assessment:{date:'2026-05-18',type:'healthcareAssociated',classification:'infection',assessedBy:'Demo IPC',summary:'Συμπτωματική ουρολοίμωξη.',symptoms:['Πυρετός','Δυσουρία'],riskFactors:[]},samples:[{id:'LAB-260518-003',type:'urineCulture',collectedAt:'2026-05-18T10:15:00',resultedAt:'2026-05-19T09:00:00',result:'positive',organism:'Escherichia coli',resistance:'ESBL',critical:false}],therapy:[{id:'TX-023',antimicrobial:'Ceftriaxone',dose:'2 g',route:'IV',startedAt:'2026-05-19',plannedEnd:'2026-05-23',endedAt:'2026-05-23',status:'completed',approved:true}],isolation:{id:'ISO-023',precautions:['contactPrecautions'],startedAt:'2026-05-19',endedAt:'2026-05-23',reason:'ESBL E. coli',status:'ended'},reassessments:[],outcome:{status:'resolved',date:'2026-05-23',notes:'Κλινική ίαση.'},timeline:[]},
  'SUR-260045': {id:'SUR-260045',patientId:'PT-260190',patient:'Νεογέννητο Ιωαννίδη',patientEn:'Neonate Ioannidi',dateOfBirth:'2026-08-20',birthWeightGrams:980,gestationalAgeWeeks:27,department:'Νεογνολογική / ΜΕΝΝ',departmentEn:'Neonatal / NICU',room:'ΜΕΝΝ-02',admissionDate:'2026-08-20',startedAt:'2026-08-24',reviewDue:'2026-08-27',status:'active',organism:'Staphylococcus epidermidis',resistance:'MRSE',source:'Αίμα',sourceEn:'Blood',haiClassification:{status:'confirmed',type:'bloodstreamInfection',definitionSet:'CDC/NHSN (simplified, age ≤1 year LCBI criteria)',criteriaMet:true,rationale:'Κοινός δερματικός κομμενσαλιστής σε δύο καλλιέργειες αίματος με άπνοια/βραδυκαρδία, συμβατό με νεογνικό CLABSI.',rationaleEn:'Common skin commensal from two blood cultures with apnea/bradycardia, compatible with neonatal CLABSI.'},devices:[{id:'DEV-26014',name:'Κεντρικός φλεβικός καθετήρας (ομφαλικός)',nameEn:'Central venous catheter (umbilical)',insertedAt:'2026-08-21',site:'Ομφαλική φλέβα',siteEn:'Umbilical vein',reviewDue:'2026-08-28',indication:'Παρεντερική διατροφή νεογνού',indicationEn:'Neonatal parenteral nutrition',status:'active'}],assessment:{date:'2026-08-24',type:'healthcareAssociated',classification:'infection',assessedBy:'Demo IPC',summary:'Επεισόδια άπνοιας/βραδυκαρδίας σε εξαιρετικά χαμηλού βάρους γέννησης νεογνό με ομφαλική γραμμή.',summaryEn:'Apnea/bradycardia episodes in an extremely-low-birth-weight neonate with an umbilical line.',symptoms:['Άπνοια','Βραδυκαρδία'],symptomsEn:['Apnea','Bradycardia'],riskFactors:['Κεντρικός καθετήρας','Εξαιρετικά χαμηλό βάρος γέννησης'],riskFactorsEn:['Central line','Extremely low birth weight']},samples:[{id:'LAB-260824-011',type:'bloodCulture',collectedAt:'2026-08-24T04:10:00',resultedAt:'2026-08-25T06:00:00',result:'positive',organism:'Staphylococcus epidermidis',resistance:'MRSE',susceptibility:'Vancomycin S · Oxacillin R',critical:false,communicatedAt:null},{id:'LAB-260825-012',type:'bloodCulture',collectedAt:'2026-08-25T04:00:00',resultedAt:'2026-08-26T06:00:00',result:'positive',organism:'Staphylococcus epidermidis',resistance:'MRSE',susceptibility:'Vancomycin S · Oxacillin R',critical:false,communicatedAt:null}],therapy:[{id:'TX-260045',antimicrobial:'Vancomycin',dose:'per neonatal protocol',route:'IV',startedAt:'2026-08-25',plannedEnd:'2026-09-03',indication:'Νεογνικό CLABSI (MRSE)',approved:true}],isolation:null,reassessments:[],outcome:null,timeline:[]},
  'SUR-260032': {id:'SUR-260032',patientId:'PT-260148',patient:'Ιωάννα Αντωνίου',patientEn:'Ioanna Antoniou',department:'Ορθοπαιδική',departmentEn:'Orthopedics',room:'OR-112',admissionDate:'2026-07-12',startedAt:'2026-07-14',reviewDue:'2026-07-17',completedAt:'2026-07-19',status:'completed',organism:'Staphylococcus aureus',resistance:'MRSA',source:'Χειρουργικό τραύμα',sourceEn:'Surgical wound',haiClassification:{status:'confirmed',type:'surgicalSiteInfection',criteriaMet:true},devices:[],assessment:{date:'2026-07-14',type:'healthcareAssociated',classification:'infection',assessedBy:'Demo IPC',summary:'Λοίμωξη χειρουργικού πεδίου.',symptoms:['Ερυθρότητα','Έκκριση'],riskFactors:['Πρόσφατη επέμβαση']},samples:[{id:'LAB-260714-006',type:'woundCulture',collectedAt:'2026-07-14T09:10:00',resultedAt:'2026-07-15T08:10:00',result:'positive',organism:'Staphylococcus aureus',resistance:'MRSA',critical:false}],therapy:[{id:'TX-032',antimicrobial:'Vancomycin',dose:'κατά πρωτόκολλο',route:'IV',startedAt:'2026-07-15',plannedEnd:'2026-07-19',endedAt:'2026-07-19',status:'completed',approved:true}],isolation:{id:'ISO-032',precautions:['contactPrecautions'],startedAt:'2026-07-15',endedAt:'2026-07-19',reason:'MRSA',status:'ended'},reassessments:[],outcome:{status:'resolved',date:'2026-07-19',notes:'Βελτίωση τραύματος.'},timeline:[]},


}

// One demo source for surveillance: list-only fixtures (older completed cases)
// become full records too, so every row in the Surveillance Center opens a
// record and every record appears in the list.
for (const row of surveillanceDemoData) {
  if (clinicalCases[row.id]) continue
  clinicalCases[row.id] = {
    id: row.id, patientId: row.patientId, patient: row.patient, patientEn: row.patientEn,
    department: row.department, departmentEn: row.departmentEn, admissionDate: row.startedAt,
    startedAt: row.startedAt, reviewDue: row.reviewDue, status: row.status,
    completedAt: row.status === 'completed' ? row.reviewDue : null,
    organism: row.organism || null, resistance: row.resistance || null,
    isolation: row.isolation ? { status: row.status === 'active' ? 'active' : 'ended', startedAt: row.startedAt } : null,
    samples: [], therapy: [], devices: [], reassessments: [], timeline: [],
  }
}

// Registry rows for the Surveillance Center, derived from the live record store.
export function demoSurveillanceList() {
  return Object.values(clinicalCases)
    .filter(item => item.lifecycleStatus !== 'voided')
    .map(item => ({
      id: item.id, patientId: item.patientId, patient: item.patient, patientEn: item.patientEn,
      department: item.department, departmentEn: item.departmentEn, startedAt: item.startedAt,
      reviewDue: item.reviewDue, status: item.status,
      organism: item.organism || item.samples?.find(sample => sample.organism)?.organism || null,
      resistance: item.resistance || null,
      isolation: item.isolation ? { ...item.isolation } : null,
      samples: item.samples || [],
    }))
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
}

export function getClinicalCase(caseId){ return clinicalCases[caseId] ?? null }
export function findCasesByPatient(patientId){
  return Object.values(clinicalCases)
    .filter((item)=>item.patientId===patientId&&item.lifecycleStatus!=='voided')
    .sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt))
}
export function findCaseByPatient(patientId){ return findCasesByPatient(patientId).find((item)=>item.status==='active') ?? findCasesByPatient(patientId)[0] ?? null }

export function createClinicalSurveillance(data){
  const now=new Date().toISOString()
  const numericIds=Object.keys(clinicalCases)
    .map(id=>Number(String(id).replace(/\D/g,'')))
    .filter(Number.isFinite)
  const next=Math.max(260000,...numericIds)+1
  const id=`SUR-${String(next).slice(-6)}`
  const record={
    id,
    patientId:data.patientId,
    patient:data.patient,
    patientEn:data.patientEn||data.patient,
    dateOfBirth:data.dateOfBirth||null,
    department:data.department,
    departmentEn:data.departmentEn||data.department,
    room:data.room||'',
    admissionDate:data.admissionDate,
    startedAt:data.startedAt,
    reviewDue:data.reviewDue,
    status:'active',
    lifecycleStatus:'active',
    createdAt:now,
    createdBy:data.createdBy||'Unknown actor',
    createdById:data.createdById||'unknown',
    updatedAt:now,
    updatedBy:data.createdBy||'Unknown actor',
    updatedById:data.createdById||'unknown',
    reason:data.reason||'',
    reasonEn:data.reasonEn||data.reason||'',
    suspectedSource:data.suspectedSource||null,
    organism:null,
    resistance:null,
    source:null,
    sourceEn:null,
    isolation:null,
    haiClassification:null,
    devices:[],
    assessment:null,
    samples:[],
    therapy:[],
    reassessments:[],
    outcome:null,
    timeline:[{
      at:now,
      type:'surveillanceStarted',
      actor:data.createdBy||'Unknown actor',
      actorId:data.createdById||'unknown',
      detail:data.reason||'',
    }],
  }
  clinicalCases[id]=record
  return record
}

export const surveillanceDeletionAudit=[]
export function deleteClinicalSurveillance(id,{actor='Unknown actor',actorId='unknown',reason='Deleted as erroneous entry'}={}){
  const existing=clinicalCases[id]
  if(!existing||existing.status!=='active')return false
  surveillanceDeletionAudit.unshift({
    id:`DEL-${Date.now()}`,
    surveillanceId:id,
    patientId:existing.patientId,
    actor,
    actorId,
    reason,
    at:new Date().toISOString(),
    snapshot:{...existing},
  })
  clinicalCases[id]={
    ...existing,
    lifecycleStatus:'voided',
    voidedAt:new Date().toISOString(),
    voidedBy:actor,
    voidedById:actorId,
    voidReason:reason,
    updatedAt:new Date().toISOString(),
    updatedBy:actor,
    updatedById:actorId,
    timeline:[{at:new Date().toISOString(),type:'surveillanceVoided',actor,actorId,detail:reason},...(existing.timeline||[])],
  }
  return true
}
