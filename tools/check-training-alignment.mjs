import fs from 'node:fs'
const p=fs.readFileSync('src/features/training/TrainingPage.jsx','utf8'),app=fs.readFileSync('src/app/App.jsx','utf8')
const tests=[
 ['create card',p.includes("setDialog({type:'program'})")&&p.includes("dialog?.type==='program'")&&!app.includes('training/new')],
 ['detail route',app.includes('training/:programId')],
 ['context navigation',p.includes('useContextualNavigation')],
 ['employee selectors',p.includes('ownerEmployeeId')&&p.includes('trainerEmployeeId')],
 ['manual dates',p.includes('ManualDateField')],
 ['five operational tabs',p.includes("label:'Συμμετέχοντες & παρουσία'")&&p.includes("label:'Αποτελέσματα & τεκμήρια'")&&!p.includes("id:'qr'")&&!p.includes("id:'feedback'")],
 ['shared actions',p.includes('RecordActions')&&p.includes('FilterBar')],
 ['Greek management microcopy',!p.includes('Training programme')&&!p.includes('eyebrow="Completion"')],
 ['hybrid owner/trainer',p.includes('StaffOrTextField')&&p.includes('Ελεύθερη καταχώρηση')],
 ['compact record actions',p.includes('Επεξεργασία προγράμματος')&&p.includes('record-inline-actions')],
 ['certificate table',p.includes('Πιστοποιητικά & τεκμήρια')&&p.includes('<table className="data-table sticky-table"')],
 ['no legacy QR card',!p.includes('function QrAttendance')&&!p.includes('record-subcard')],
 ['participants render wiring',p.includes("tab==='participants'&&<Participants")&&p.includes('program={program}')&&p.includes('onRegenerate={regenerateQr}')&&p.includes('function Participants({rows,program,onAdd,onResponse,onRegenerate,onDelete})')],
 ['no translated component identifiers',!p.includes('<Συμμετέχοντες')&&!p.includes('function Συμμετέχοντες')&&!p.includes('<ΟλοκλήρωσηDialog')&&!p.includes('function ΟλοκλήρωσηDialog')],
 ['participant add at right',p.includes('training-participant-actions')&&p.includes('training-add-participant')],
 ['material upload',p.includes('type="file"')&&p.includes('fileName')&&p.includes('materialTypeFromFile')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`Training alignment smoke passed: ${tests.length}/${tests.length}`)
