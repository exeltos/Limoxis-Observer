export const employeeRows = [
  {id:'EMP-001',firstName:'Μαρία',firstNameEn:'Maria',lastName:'Παπαδοπούλου',lastNameEn:'Papadopoulou',fatherName:'Ιωάννης',fatherNameEn:'Ioannis',department:'ΜΕΘ',departmentEn:'ICU',profession:'Νοσηλευτικό προσωπικό',professionEn:'Nursing staff',employmentStatus:'active',email:'m.papadopoulou@example.org',phone:'210 555 0101',hireDate:'2019-03-18'},
  {id:'EMP-002',firstName:'Νικόλαος',firstNameEn:'Nikolaos',lastName:'Δημητρίου',lastNameEn:'Dimitriou',fatherName:'Αλέξανδρος',fatherNameEn:'Alexandros',department:'Παθολογική',departmentEn:'Internal Medicine',profession:'Ιατρικό προσωπικό',professionEn:'Medical staff',employmentStatus:'active',email:'n.dimitriou@example.org',phone:'210 555 0102',hireDate:'2021-09-01'},
  {id:'EMP-003',firstName:'Ελένη',firstNameEn:'Eleni',lastName:'Κωνσταντίνου',lastNameEn:'Konstantinou',fatherName:'Δημήτριος',fatherNameEn:'Dimitrios',department:'Χειρουργική',departmentEn:'Surgery',profession:'Νοσηλευτικό προσωπικό',professionEn:'Nursing staff',employmentStatus:'active',email:'e.konstantinou@example.org',phone:'210 555 0103',hireDate:'2017-01-12'},
  {id:'EMP-004',firstName:'Γεώργιος',firstNameEn:'Georgios',lastName:'Αντωνίου',lastNameEn:'Antoniou',fatherName:'Νικόλαος',fatherNameEn:'Nikolaos',department:'Εργαστήριο',departmentEn:'Laboratory',profession:'Εργαστηριακό προσωπικό',professionEn:'Laboratory staff',employmentStatus:'inactive',email:'g.antoniou@example.org',phone:'210 555 0104',hireDate:'2015-06-15'},
]

export const occupationalVisits = [
  {id:'OHV-001',employeeId:'EMP-001',date:'2026-08-27',type:'periodic',status:'completed',followUpDate:'2027-08-27',fitStatus:'fit'},
  {id:'OHV-002',employeeId:'EMP-002',date:'2026-08-28',type:'followUp',status:'scheduled',followUpDate:null,fitStatus:'pending'},
  {id:'OHV-003',employeeId:'EMP-003',date:'2026-08-30',type:'vaccinationReview',status:'scheduled',followUpDate:null,fitStatus:'pending'},
]

export const employeeVaccinations = [
  {id:'VAC-001',employeeId:'EMP-001',vaccine:'Hepatitis B',dose:'3',date:'2025-10-12',validUntil:null,status:'complete'},
  {id:'VAC-002',employeeId:'EMP-002',vaccine:'Influenza',dose:'2025/26',date:'2025-10-20',validUntil:'2026-10-01',status:'renewSoon'},
  {id:'VAC-003',employeeId:'EMP-003',vaccine:'Influenza',dose:'2025/26',date:'2025-11-03',validUntil:'2026-10-01',status:'renewSoon'},
]

export const employeeTraining = [
  {id:'TR-01', employeeId:'EMP-001', titleEl:'Υγιεινή Χεριών', titleEn:'Hand Hygiene', date:'2026-05-12', status:'completed'},
  {id:'TR-02', employeeId:'EMP-001', titleEl:'Πρόληψη Λοιμώξεων', titleEn:'Infection Prevention', date:'2026-07-04', status:'completed'},
  {id:'TR-03', employeeId:'EMP-002', titleEl:'Ασφάλεια ασθενών', titleEn:'Patient Safety', date:'2026-06-18', status:'completed'},
]
export const employeeEvaluations = [
  {id:'EV-01', employeeId:'EMP-001', titleEl:'Ετήσια αξιολόγηση', titleEn:'Annual evaluation', date:'2026-02-20', resultEl:'Ολοκληρωμένη', resultEn:'Completed'},
]
export const employeeCertificates = [
  {id:'CERT-01', employeeId:'EMP-001', titleEl:'BLS', titleEn:'BLS', issuer:'ERC', issueDate:'2025-04-01', validUntil:'2027-03-31', certificateNumber:'BLS-2025-001', attachments:[]},
]
