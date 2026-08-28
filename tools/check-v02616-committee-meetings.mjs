import fs from 'node:fs'
const p=fs.readFileSync('src/features/committees/CommitteeRecordPage.jsx','utf8')
const tests=[
 ['meeting type',p.includes("meetingType:'regular'")&&p.includes('Έκτακτη')],
 ['attendance',p.includes('attendanceRecords:createAttendance')&&p.includes('Παρουσίες & απαρτία')],
 ['quorum guard',p.includes('χωρίς την απαιτούμενη απαρτία')],
 ['structured topics',p.includes('Θέματα συζήτησης & αποφάσεις')&&p.includes('createTopic()')],
 ['followup actions',p.includes('Δημιουργία ενέργειας follow-up')&&p.includes('nextDecisions=[...generated')],
 ['minutes approvals',p.includes('requestMinutesApprovals')&&p.includes('Έγκριση πρακτικών')],
 ['audit history',p.includes("action:'Δημιουργία συνεδρίασης'")&&p.includes('historyAction=')],
 ['shared dialog/button',p.includes('ObserverDialog eyebrow="Συνεδρίαση & πρακτικά"')&&p.includes('<Button onClick={addTopic}>')]
]
for(const [n,ok] of tests){if(!ok){console.error('FAIL',n);process.exit(1)}console.log('✓',n)}
console.log(`v0.26.16 committee meeting smoke passed: ${tests.length}/${tests.length}`)
