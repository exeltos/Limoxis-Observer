import fs from 'node:fs'
const file='src/features/surveillance/PatientClinicalRecordPage.jsx'
const text=fs.readFileSync(file,'utf8')
const checks=[
 'createdById:previous?.createdById||actor.id',
 "type:'therapyUpdated',actor:actor.name,actorId:actor.id",
 'byId:actor.id,createdAt:now,createdBy:actor.name,createdById:actor.id',
 "type:'reassessment',actor:actor.name,actorId:actor.id",
 'recordedById:actor.id',
 "record.lifecycleStatus='finalized'",
 'finalizedById=actor.id',
 "type:'outcome',actor:actor.name,actorId:actor.id",
 'assessedById:a.assessedById||actor.id',
 'record.isolationDecision={required:true,decidedAt:now,by:actor.name,byId:actor.id}',
 "type:'isolationNotRequired',actor:actor.name,actorId:actor.id",
 "type:'haiClassificationUpdated',actor:actor.name,actorId:actor.id",
]
let failed=0
for(const needle of checks){if(!text.includes(needle)){console.error(`Missing ${needle}`);failed++}}
if(failed)process.exit(1)
console.log(`Clinical event audit passed: ${checks.length}/${checks.length}`)
