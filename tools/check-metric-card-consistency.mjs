import fs from 'node:fs';import path from 'node:path';
const component=fs.readFileSync('src/design-system/MetricCard.jsx','utf8');const css=fs.readFileSync('src/styles/global.css','utf8');
const required=['canonical-metric-card','canonical-metric-icon','canonical-metric-copy'];let fail=0;
for(const x of required)if(!component.includes(x)&&!css.includes(x)){console.error('Missing '+x);fail++}
const featureFiles=['laboratory/LaboratoryPage.jsx','patients/PatientsPage.jsx','controls/ControlsPage.jsx','quality/QualityPage.jsx','documents/DocumentsPage.jsx','employees/EmployeesPage.jsx','occupational-health/OccupationalHealthPage.jsx','prevention/PreventionPage.jsx','surveillance/SurveillancePage.jsx','training/TrainingPage.jsx','committees/CommitteesPage.jsx','committees/CommitteeRecordPage.jsx'];
for(const rel of featureFiles){const t=fs.readFileSync(path.join('src/features',rel),'utf8');if(!t.includes('MetricCard')){console.error('MetricCard not used: '+rel);fail++}if(/className="(?:employee-kpi|module-summary-metric|lab-kpi|patient-summary-metric)"/.test(t)){console.error('Legacy metric markup: '+rel);fail++}}
for(const needle of ['font-size:21px!important','font-size:10.5px!important','width:18px!important','height:96px!important'])if(!css.includes(needle)){console.error('Missing metric token '+needle);fail++}
if(fail)process.exit(1);console.log(`Metric card consistency passed: ${featureFiles.length} feature screens + shared typography/icon contract`)
