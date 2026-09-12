export const preventionDepartments=[
  {id:'dep-icu',el:'ΜΕΘ',en:'ICU'},
  {id:'dep-internal',el:'Παθολογική',en:'Internal Medicine'},
  {id:'dep-surgery',el:'Χειρουργική',en:'Surgery'},
]

export const wasteTypeLibrary=[
  {id:'wt-infectious',code:'WASTE-INF',el:'Μολυσματικά απόβλητα',en:'Infectious waste'},
  {id:'wt-sharps',code:'WASTE-SHARP',el:'Αιχμηρά αντικείμενα',en:'Sharps'},
  {id:'wt-pharma',code:'WASTE-PHARMA',el:'Φαρμακευτικά απόβλητα',en:'Pharmaceutical waste'},
]

export const antisepticLibrary=[
  {id:'ant-abhr',code:'ANT-ABHR',el:'Αλκοολούχο αντισηπτικό χεριών (ABHR)',en:'Alcohol-based handrub (ABHR)',metadata:{is_abhr:true}},
  {id:'ant-surgical',code:'ANT-SURG',el:'Χειρουργικό αντισηπτικό διάλυμα',en:'Surgical antiseptic solution',metadata:{is_abhr:false}},
]

export const bundleTemplateLibrary=[
  {
    dbId:'tmpl-clabsi',id:'CLABSI',bundleKey:'CLABSI',name:'CLABSI Bundle',
    title:'Δέσμη πρόληψης CLABSI',titleEl:'Δέσμη πρόληψης CLABSI',titleEn:'CLABSI Prevention Bundle',
    version:'1.0',status:'published',scope:'icu',source:'WHO',sourceVersion:'2024',system:true,departments:[],
    rawElements:[
      {id:'hand_hygiene',labelEl:'Υγιεινή χεριών πριν την εισαγωγή',labelEn:'Hand hygiene before insertion'},
      {id:'barrier',labelEl:'Μέγιστες προφυλάξεις φραγμού',labelEn:'Maximal barrier precautions'},
      {id:'skin_prep',labelEl:'Αντισηψία δέρματος με χλωρεξιδίνη',labelEn:'Chlorhexidine skin antisepsis'},
      {id:'site_review',labelEl:'Καθημερινή επανεκτίμηση σημείου εισόδου',labelEn:'Daily insertion site review'},
    ],
  },
  {
    dbId:'tmpl-vae',id:'VAE',bundleKey:'VAE',name:'VAE Bundle',
    title:'Δέσμη πρόληψης VAE',titleEl:'Δέσμη πρόληψης VAE',titleEn:'VAE Prevention Bundle',
    version:'1.0',status:'published',scope:'icu',source:'WHO',sourceVersion:'2024',system:true,departments:[],
    rawElements:[
      {id:'head_elevation',labelEl:'Ανύψωση κεφαλής 30-45°',labelEn:'Head-of-bed elevation 30–45°'},
      {id:'oral_care',labelEl:'Στοματική φροντίδα με χλωρεξιδίνη',labelEn:'Chlorhexidine oral care'},
      {id:'sedation_break',labelEl:'Ημερήσια διακοπή καταστολής',labelEn:'Daily sedation interruption'},
    ],
  },
].map(template=>({...template,elements:template.rawElements.map(item=>[item.id,item.labelEl])}))

function whoStatsFromObservations(items){
  const weight=item=>Math.max(1,Number(item.professionalsCount)||1)
  const opportunities=items.reduce((sum,item)=>sum+weight(item),0)
  const handRub=items.reduce((sum,item)=>sum+(item.action==='HR'?weight(item):0),0)
  const handWash=items.reduce((sum,item)=>sum+(item.action==='HW'?weight(item):0),0)
  const missed=items.reduce((sum,item)=>sum+(item.action==='MISSED'?weight(item):0),0)
  const compliant=handRub+handWash
  return {opportunities,handRub,handWash,missed,professionals:opportunities,compliant,compliance:opportunities?Number(((compliant/opportunities)*100).toFixed(1)):0}
}

function handHygieneRow({id,date,department,profession,observer,startTime,endTime,items}){
  const stats=whoStatsFromObservations(items)
  return {
    id,date,departmentEl:department.el,departmentEn:department.en,profession,
    observations:stats.opportunities,compliant:stats.compliant,rate:stats.compliance,observer,
    session:{department:department.el,date,observer,startTime,endTime},
    whoObservations:items,whoStats:stats,lifecycleStatus:'active',
    createdAt:`${date}T${startTime}:00`,createdById:'demo-user',updatedAt:`${date}T${endTime}:00`,updatedById:'demo-user',
  }
}

export const handHygieneRows=[
  handHygieneRow({id:'HH-2601',date:'2026-08-20',department:preventionDepartments[0],profession:'nursing',observer:'Ελένη Παπαδοπούλου',startTime:'09:00',endTime:'09:40',items:[
    {id:'o1',professionalsCount:1,professionalCategory:'Νοσηλευτικό',moments:['before_patient'],action:'HR',gloves:false,notes:''},
    {id:'o2',professionalsCount:1,professionalCategory:'Νοσηλευτικό',moments:['after_patient'],action:'HR',gloves:true,notes:''},
    {id:'o3',professionalsCount:1,professionalCategory:'Νοσηλευτικό',moments:['before_aseptic'],action:'HW',gloves:false,notes:''},
    {id:'o4',professionalsCount:1,professionalCategory:'Νοσηλευτικό',moments:['after_body_fluid'],action:'MISSED',gloves:false,notes:'Διακοπή λόγω επείγοντος'},
  ]}),
  handHygieneRow({id:'HH-2602',date:'2026-08-25',department:preventionDepartments[1],profession:'medical',observer:'Νικόλαος Δημητρίου',startTime:'11:15',endTime:'11:45',items:[
    {id:'o1',professionalsCount:1,professionalCategory:'Ιατρικό',moments:['before_patient'],action:'HR',gloves:false,notes:''},
    {id:'o2',professionalsCount:1,professionalCategory:'Ιατρικό',moments:['after_patient'],action:'HR',gloves:false,notes:''},
    {id:'o3',professionalsCount:1,professionalCategory:'Ιατρικό',moments:['after_surroundings'],action:'HR',gloves:false,notes:''},
  ]}),
  handHygieneRow({id:'HH-2603',date:'2026-09-02',department:preventionDepartments[0],profession:'nursing',observer:'Ελένη Παπαδοπούλου',startTime:'14:00',endTime:'14:30',items:[
    {id:'o1',professionalsCount:1,professionalCategory:'Νοσηλευτικό',moments:['before_aseptic'],action:'HW',gloves:true,notes:''},
    {id:'o2',professionalsCount:1,professionalCategory:'Νοσηλευτικό',moments:['after_body_fluid'],action:'HW',gloves:true,notes:''},
  ]}),
]

function wasteRow({id,periodStart,periodEnd,department,type,weight,containers,patientDays,responsible,documentNumber,collectionCompany}){
  return {
    id,date:periodEnd,periodStart,periodEnd,period:periodStart===periodEnd?periodStart:`${periodStart} – ${periodEnd}`,
    departmentEl:department.el,departmentEn:department.en,
    wasteType:type.el,type:type.el,typeEn:type.en,wasteTypeId:type.id,
    weight,containers,patientDays:patientDays||null,patientDaysSource:patientDays?'manual':'',
    indicator:patientDays?Number((weight/patientDays*1000).toFixed(2)):null,
    responsible,documentNumber,collectionCompany,notes:'',status:'completed',lifecycleStatus:'active',
    createdAt:`${periodEnd}T08:00:00`,createdById:'demo-user',updatedAt:`${periodEnd}T08:00:00`,updatedById:'demo-user',
  }
}

export const wasteRows=[
  wasteRow({id:'WST-2601',periodStart:'2026-08-01',periodEnd:'2026-08-31',department:preventionDepartments[0],type:wasteTypeLibrary[0],weight:184.5,containers:12,patientDays:620,responsible:'Γεώργιος Αντωνίου',documentNumber:'ΤΠ-1042',collectionCompany:'EcoBio Α.Ε.'}),
  wasteRow({id:'WST-2602',periodStart:'2026-08-01',periodEnd:'2026-08-31',department:preventionDepartments[2],type:wasteTypeLibrary[1],weight:22.3,containers:4,patientDays:410,responsible:'Γεώργιος Αντωνίου',documentNumber:'ΤΠ-1043',collectionCompany:'EcoBio Α.Ε.'}),
  wasteRow({id:'WST-2603',periodStart:'2026-09-01',periodEnd:'2026-09-10',department:preventionDepartments[0],type:wasteTypeLibrary[2],weight:9.8,containers:2,patientDays:null,responsible:'Γεώργιος Αντωνίου',documentNumber:'ΤΠ-1055',collectionCompany:'EcoBio Α.Ε.'}),
]

function antisepticRow({id,periodStart,periodEnd,department,product,litres,patientDays,method,referenceNumber,responsible}){
  const eligible=Boolean(product.metadata?.is_abhr)
  return {
    id,period:periodStart.slice(0,7),periodStart,periodEnd,departmentEl:department.el,departmentEn:department.en,
    product:product.el,productEn:product.en,antisepticItemId:product.id,productCode:product.code,
    litres,patientDays:patientDays||null,patientDaysSource:patientDays?'manual':'',
    indicator:eligible&&patientDays?Number((litres/patientDays*1000).toFixed(2)):null,indicatorEligible:eligible,
    method,referenceNumber,responsible,notes:'',lifecycleStatus:'active',
    createdAt:`${periodEnd}T08:00:00`,createdById:'demo-user',updatedAt:`${periodEnd}T08:00:00`,updatedById:'demo-user',
  }
}

export const antisepticRows=[
  antisepticRow({id:'ANT-2601',periodStart:'2026-08-01',periodEnd:'2026-08-31',department:preventionDepartments[0],product:antisepticLibrary[0],litres:41.2,patientDays:620,method:'manual',referenceNumber:'ΔΤ-330',responsible:'Ελένη Παπαδοπούλου'}),
  antisepticRow({id:'ANT-2602',periodStart:'2026-08-01',periodEnd:'2026-08-31',department:preventionDepartments[1],product:antisepticLibrary[0],litres:18.6,patientDays:505,method:'manual',referenceNumber:'ΔΤ-331',responsible:'Νικόλαος Δημητρίου'}),
  antisepticRow({id:'ANT-2603',periodStart:'2026-09-01',periodEnd:'2026-09-10',department:preventionDepartments[2],product:antisepticLibrary[1],litres:6.4,patientDays:null,method:'manual',referenceNumber:'ΔΤ-340',responsible:'Ελένη Κωνσταντίνου'}),
]

function bundleAssessmentRow({id,template,department,date,answers,shift,context,owner}){
  const elementIds=template.rawElements.map(item=>item.id)
  const applicable=elementIds.map(itemId=>answers[itemId]).filter(x=>x==='yes'||x==='no')
  const yes=applicable.filter(x=>x==='yes').length
  const score=applicable.length?Math.round((yes/applicable.length)*100):null
  const failedCount=applicable.length-yes
  const findings=template.rawElements.filter(item=>answers[item.id]==='no').map(item=>({id:item.id,label:item.labelEl,note:''}))
  return {
    id,bundle:template.bundleKey,templateId:template.bundleKey,templateName:template.name,templateTitle:template.titleEl,
    templateVersion:template.version,templateSource:template.source,templateSnapshot:template,
    departmentEl:department.el,departmentEn:department.en,date,period:date,score,answers,answerNotes:{},
    shift,context,patientId:'',patientRef:'',deviceId:'',deviceRef:'',generalNotes:'',
    applicableCount:applicable.length,failedCount,allOrNone:applicable.length>0&&failedCount===0,
    findings,owner,status:'completed',lifecycleStatus:'active',
    createdAt:`${date}T10:00:00`,createdById:'demo-user',updatedAt:`${date}T10:00:00`,updatedById:'demo-user',
  }
}

export const bundleRows=[
  bundleAssessmentRow({id:'BND-2601',template:bundleTemplateLibrary[0],department:preventionDepartments[0],date:'2026-08-22',shift:'morning',context:'Κεντρικός φλεβικός καθετήρας',owner:'Ελένη Παπαδοπούλου',answers:{hand_hygiene:'yes',barrier:'yes',skin_prep:'yes',site_review:'yes'}}),
  bundleAssessmentRow({id:'BND-2602',template:bundleTemplateLibrary[1],department:preventionDepartments[0],date:'2026-08-27',shift:'night',context:'Μηχανικός αερισμός',owner:'Νικόλαος Δημητρίου',answers:{head_elevation:'yes',oral_care:'no',sedation_break:'yes'}}),
  bundleAssessmentRow({id:'BND-2603',template:bundleTemplateLibrary[0],department:preventionDepartments[2],date:'2026-09-05',shift:'morning',context:'Κεντρικός φλεβικός καθετήρας',owner:'Ελένη Κωνσταντίνου',answers:{hand_hygiene:'yes',barrier:'na',skin_prep:'yes',site_review:'yes'}}),
]
