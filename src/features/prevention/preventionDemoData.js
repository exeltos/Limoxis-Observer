export const handHygieneRows=[
  {id:'HH-2608-014',date:'2026-08-26',departmentEl:'ΜΕΘ',departmentEn:'ICU',profession:'nursing',observations:28,compliant:24,rate:85.7,observer:'Μ. Παπαδοπούλου'},
  {id:'HH-2608-013',date:'2026-08-25',departmentEl:'Χειρουργική',departmentEn:'Surgery',profession:'medical',observations:20,compliant:16,rate:80,observer:'Ν. Γεωργίου'},
  {id:'HH-2608-012',date:'2026-08-24',departmentEl:'Παθολογική',departmentEn:'Internal Medicine',profession:'nursing',observations:32,compliant:29,rate:90.6,observer:'Α. Δημητρίου'},
  {id:'HH-2608-011',date:'2026-08-22',departmentEl:'ΜΕΘ',departmentEn:'ICU',profession:'medical',observations:18,compliant:13,rate:72.2,observer:'Μ. Παπαδοπούλου'},
]
export const wasteRows=[
  {id:'W-2608-09',date:'2026-08-26',departmentEl:'ΜΕΘ',departmentEn:'ICU',type:'infectiousWaste',weight:42.5,containers:7,status:'completed'},
  {id:'W-2608-08',date:'2026-08-25',departmentEl:'Χειρουργική',departmentEn:'Surgery',type:'mixedHazardousWaste',weight:31.2,containers:5,status:'completed'},
  {id:'W-2608-07',date:'2026-08-24',departmentEl:'Παθολογική',departmentEn:'Internal Medicine',type:'infectiousWaste',weight:18.8,containers:3,status:'completed'},
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
