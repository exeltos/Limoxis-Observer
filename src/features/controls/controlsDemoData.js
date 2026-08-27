export const demoControls=[
  {id:'CTRL-001',title:'Έλεγχος εφαρμογής isolation precautions',titleEn:'Isolation precautions implementation check',department:'ΜΕΘ',departmentEn:'ICU',due:'2026-08-28',status:'assigned',owner:'Υπεύθυνος ΜΕΘ',description:'Έλεγχος εφαρμογής των απαιτούμενων isolation precautions στο τμήμα.',descriptionEn:'Review of required isolation precautions implementation in the department.',history:[]},
  {id:'CTRL-002',title:'Έλεγχος PPE',titleEn:'PPE check',department:'ΜΕΘ',departmentEn:'ICU',due:'2026-08-30',status:'dueSoon',owner:'Προϊστάμενος ΜΕΘ',description:'Έλεγχος διαθεσιμότητας και ορθής χρήσης ΜΑΠ.',descriptionEn:'Check availability and correct use of PPE.',history:[]},
]
export const getControl=(id)=>demoControls.find(x=>x.id===id)??null
