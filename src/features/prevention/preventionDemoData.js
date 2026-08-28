export const handHygieneRows=[
  {id:'HH-2608-014',date:'2026-08-26',departmentEl:'ΜΕΘ',departmentEn:'ICU',profession:'nursing',observations:5,compliant:4,rate:80,observer:'Μ. Παπαδοπούλου',session:{facility:'ΙΑΣΩ Θεσσαλίας',startTime:'09:00',endTime:'09:25'},whoObservations:[
    {id:'WHO-1',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment1',action:'HR',gloves:false,notes:''},
    {id:'WHO-2',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment2',action:'HR',gloves:false,notes:''},
    {id:'WHO-3',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment3',action:'HW',gloves:true,notes:''},
    {id:'WHO-4',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment4',action:'MISSED',gloves:false,notes:'Δεν πραγματοποιήθηκε υγιεινή χεριών.'},
    {id:'WHO-5',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment5',action:'HR',gloves:false,notes:''}
  ]},
  {id:'HH-2608-013',date:'2026-08-25',departmentEl:'Χειρουργική',departmentEn:'Surgery',profession:'medical',observations:4,compliant:3,rate:75,observer:'Ν. Γεωργίου',session:{facility:'ΙΑΣΩ Θεσσαλίας',startTime:'11:10',endTime:'11:35'},whoObservations:[
    {id:'WHO-6',professionalsCount:1,professionalCategory:'Ιατρός',moment:'moment1',action:'HR',gloves:false,notes:''},
    {id:'WHO-7',professionalsCount:1,professionalCategory:'Ιατρός',moment:'moment2',action:'MISSED',gloves:true,notes:''},
    {id:'WHO-8',professionalsCount:1,professionalCategory:'Ιατρός',moment:'moment4',action:'HR',gloves:false,notes:''},
    {id:'WHO-9',professionalsCount:1,professionalCategory:'Ιατρός',moment:'moment5',action:'HW',gloves:false,notes:''}
  ]},
  {id:'HH-2608-012',date:'2026-08-24',departmentEl:'Παθολογική',departmentEn:'Internal Medicine',profession:'nursing',observations:5,compliant:5,rate:100,observer:'Α. Δημητρίου',session:{facility:'ΙΑΣΩ Θεσσαλίας',startTime:'08:30',endTime:'08:55'},whoObservations:[
    {id:'WHO-10',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment1',action:'HR',gloves:false,notes:''},
    {id:'WHO-11',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment2',action:'HR',gloves:false,notes:''},
    {id:'WHO-12',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment3',action:'HW',gloves:true,notes:''},
    {id:'WHO-13',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment4',action:'HR',gloves:false,notes:''},
    {id:'WHO-14',professionalsCount:1,professionalCategory:'Νοσηλευτής / Νοσηλεύτρια',moment:'moment5',action:'HR',gloves:false,notes:''}
  ]},
  {id:'HH-2608-011',date:'2026-08-22',departmentEl:'ΜΕΘ',departmentEn:'ICU',profession:'medical',observations:5,compliant:3,rate:60,observer:'Μ. Παπαδοπούλου',session:{facility:'ΙΑΣΩ Θεσσαλίας',startTime:'14:00',endTime:'14:20'},whoObservations:[
    {id:'WHO-15',professionalsCount:1,professionalCategory:'Ιατρός',moment:'moment1',action:'MISSED',gloves:false,notes:''},
    {id:'WHO-16',professionalsCount:1,professionalCategory:'Ιατρός',moment:'moment2',action:'HR',gloves:false,notes:''},
    {id:'WHO-17',professionalsCount:1,professionalCategory:'Ιατρός',moment:'moment3',action:'HW',gloves:true,notes:''},
    {id:'WHO-18',professionalsCount:1,professionalCategory:'Ιατρός',moment:'moment4',action:'MISSED',gloves:false,notes:''},
    {id:'WHO-19',professionalsCount:1,professionalCategory:'Ιατρός',moment:'moment5',action:'HR',gloves:false,notes:''}
  ]},
]
export const wasteRows=[
  {id:'W-2608-09',date:'2026-08-26',departmentEl:'ΜΕΘ',departmentEn:'ICU',wasteType:'ΕΑΑΜ',type:'ΕΑΑΜ',typeEn:'Infectious healthcare waste',weight:42.5,containers:7,patientDays:372,indicator:114.25,responsible:'Μ. Παπαδοπούλου',documentNumber:'EAAM-0826',collectionCompany:'EcoMed',notes:'',status:'completed'},
  {id:'W-2608-08',date:'2026-08-25',departmentEl:'Χειρουργική',departmentEn:'Surgery',wasteType:'ΜΕΑ',type:'ΜΕΑ',typeEn:'Mixed hazardous waste',weight:31.2,containers:5,patientDays:318,indicator:98.11,responsible:'Ν. Γεωργίου',documentNumber:'MEA-0825',collectionCompany:'EcoMed',notes:'',status:'completed'},
  {id:'W-2608-07',date:'2026-08-24',departmentEl:'Παθολογική',departmentEn:'Internal Medicine',wasteType:'ΕΑΑΜ',type:'ΕΑΑΜ',typeEn:'Infectious healthcare waste',weight:18.8,containers:3,patientDays:441,indicator:42.63,responsible:'Α. Δημητρίου',documentNumber:'EAAM-0824',collectionCompany:'EcoMed',notes:'',status:'completed'},
]
export const antisepticRows=[
  {id:'A-2026-08-ICU',period:'2026-08',departmentEl:'ΜΕΘ',departmentEn:'ICU',product:'Alcohol hand rub 500 ml',litres:48.5},
  {id:'A-2026-08-SUR',period:'2026-08',departmentEl:'Χειρουργική',departmentEn:'Surgery',product:'Alcohol hand rub 500 ml',litres:35.0},
  {id:'A-2026-08-IM',period:'2026-08',departmentEl:'Παθολογική',departmentEn:'Internal Medicine',product:'Alcohol hand rub 500 ml',litres:29.5},
]
export const bundleRows=[
  {id:'B-CLABSI-ICU',bundle:'clabsiBundle',departmentEl:'ΜΕΘ',departmentEn:'ICU',period:'2026-08',score:92,status:'active'},
  {id:'B-CAUTI-IM',bundle:'cautiBundle',departmentEl:'Παθολογική',departmentEn:'Internal Medicine',period:'2026-08',score:86,status:'active'},
  {id:'B-VAP-ICU',bundle:'vapBundle',departmentEl:'ΜΕΘ',departmentEn:'ICU',period:'2026-08',score:89,status:'active'},
]
