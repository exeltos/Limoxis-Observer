import fs from 'node:fs'
const p=fs.readFileSync('src/features/training/TrainingPage.jsx','utf8')
const tests=[
 ['participant delete icon',p.includes('Διαγραφή συμμετέχοντα')&&p.includes('onDelete={row=>setDialog')],
 ['participant delete dialog',p.includes('function DeleteParticipantDialog')&&p.includes('Για λόγους ιστορικότητας')],
 ['evidence delete guard',p.includes('row.checkInAt||row.completionConfirmedAt||row.completedDate')],
 ['material dataUrl persistence',p.includes('reader.readAsDataURL(f)')&&p.includes('dataUrl')],
 ['material clean browser view',p.includes('openTrainingMaterial')&&p.includes("window.open(target,'_blank','noopener,noreferrer')")&&!p.includes('training-material-preview')],
 ['stale upload recovery message',p.includes('ανεβάστε ξανά το αρχείο μία φορά')]
]
for(const [name,ok] of tests){if(!ok){console.error('FAIL',name);process.exit(1)}console.log('✓',name)}
console.log(`v0.26.13 training fixes smoke passed: ${tests.length}/${tests.length}`)
