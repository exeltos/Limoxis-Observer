import { createDemoLabSample, laboratorySamples } from '../laboratory/laboratoryDemoData'

export const environmentalSurveillanceRecords=[]
export const environmentalSurveillanceBatches=[]

export const environmentalSubjectCatalog=[
  {id:'surface',label:'surfaces',sampleType:'surfaceSample',defaultSource:'surfaceSwab',supportsPlate:true},
  {id:'room',label:'rooms',sampleType:'environmentalSample',defaultSource:'roomSampling',supportsPlate:true},
  {id:'air',label:'air',sampleType:'airSample',defaultSource:'airSampling',supportsPlate:false},
  {id:'water',label:'water',sampleType:'waterSample',defaultSource:'waterSampling',supportsPlate:false},
]

export const environmentalSourceCatalog={
  surfaceSwab:{label:'surfaceSwab',el:'Επίχρισμα επιφάνειας',en:'Surface swab'},
  contactPlate:{label:'contactPlate',el:'Πλάκα επαφής',en:'Contact plate'},
  roomSampling:{label:'roomSampling',el:'Περιβαλλοντική δειγματοληψία χώρου',en:'Room environmental sampling'},
  airSampling:{label:'airSampling',el:'Δειγματοληψία αέρα',en:'Air sampling'},
  passiveAir:{label:'passiveAir',el:'Παθητική δειγματοληψία αέρα',en:'Passive air sampling'},
  activeAir:{label:'activeAir',el:'Ενεργητική δειγματοληψία αέρα',en:'Active air sampling'},
  waterSampling:{label:'waterSampling',el:'Δειγματοληψία νερού',en:'Water sampling'},
  tapWater:{label:'tapWater',el:'Νερό βρύσης',en:'Tap water'},
  showerWater:{label:'showerWater',el:'Νερό ντους',en:'Shower water'},
  other:{label:'other',el:'Άλλο',en:'Other'},
}

function nextId(){return `ENV-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(environmentalSurveillanceRecords.length+1).padStart(3,'0')}`}
function nextBatchId(){return `ENVB-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(environmentalSurveillanceBatches.length+1).padStart(3,'0')}`}
function nextLabId(){return `LAB-${new Date().toISOString().slice(2,10).replaceAll('-','')}-${String(laboratorySamples.length+1).padStart(3,'0')}`}

function baseRecord({id,subjectType,department,departmentEn,location,locationEn,point,pointEn,sourceCode,startedAt,batchId,sampleId,notes,plateCode=null,platePosition=null}){
  return {
    id,subjectType,department,departmentEn,location,locationEn:locationEn||location,point,pointEn:pointEn||point,sourceCode,startedAt,batchId,sampleId,
    plateCode,platePosition,status:'active',notes,result:null,cfu:null,limitCfu:null,withinLimit:null,organism:null,organisms:[],
    timeline:[{at:new Date().toISOString(),type:'environmentalSurveillanceStarted',actor:'Current user'}],
  }
}

function createIndividualLabSample({record,createdBy}){
  const cfg=environmentalSubjectCatalog.find(x=>x.id===record.subjectType)||environmentalSubjectCatalog[0]
  const source=environmentalSourceCatalog[record.sourceCode]||environmentalSourceCatalog[cfg.defaultSource]||environmentalSourceCatalog.other
  const subjectName=[record.location,record.point].filter(Boolean).join(' · ')
  const subjectNameEn=[record.locationEn||record.location,record.pointEn||record.point].filter(Boolean).join(' · ')
  createDemoLabSample({
    id:record.sampleId,workflowType:'environmental_individual',subjectType:record.subjectType,environmentalSurveillanceCase:record.id,
    patient:subjectName,patientEn:subjectNameEn,patientId:record.id,department:record.department,departmentEn:record.departmentEn,
    type:cfg.sampleType,source:source.el,sourceEn:source.en,sourceCode:record.sourceCode,anatomicalSite:record.point||record.location,
    collectedAt:`${record.startedAt}T12:00:00`,receivedAt:null,status:'requested',priority:'routine',result:null,resultStatus:'draft',
    organism:null,organisms:[],resistance:null,critical:false,surveillanceCase:null,batchId:record.batchId,ast:[],communications:[],attachments:[],
    timeline:[{at:new Date().toISOString(),type:'environmentalSampleRequested',actor:createdBy}],notes:record.notes,
  })
}

export function createEnvironmentalSurveillance({subjectType,department,departmentEn,location,locationEn,point,pointEn,sourceCode,startedAt,notes='',batchId=null,createdBy='Current user'}){
  const id=nextId(), sampleId=nextLabId()
  const record=baseRecord({id,subjectType,department,departmentEn,location,locationEn,point,pointEn,sourceCode,startedAt,batchId,sampleId,notes})
  record.timeline[0].actor=createdBy
  environmentalSurveillanceRecords.unshift(record)
  createIndividualLabSample({record,createdBy})
  return record
}

export function createEnvironmentalBatch({items,subjectType,startedAt,department,departmentEn,sourceCode,notes='',grouping='individual',createdBy='Current user'}){
  const id=nextBatchId()
  const records=[]
  const plateGroups=new Map()

  items.forEach((item,index)=>{
    const recordId=nextId()
    const plateCode=grouping==='plate'?(item.plateCode||'A').trim().toUpperCase():null
    const platePosition=grouping==='plate'?(item.platePosition||String(index+1)).trim():null
    const sampleId=grouping==='plate'?null:nextLabId()
    const record=baseRecord({
      id:recordId,subjectType,department:item.department||department,departmentEn:item.departmentEn||departmentEn,
      location:item.location,locationEn:item.locationEn||item.location,point:item.point,pointEn:item.pointEn||item.point,
      sourceCode,startedAt,batchId:id,sampleId,notes,plateCode,platePosition
    })
    record.timeline[0].actor=createdBy
    environmentalSurveillanceRecords.unshift(record)
    records.push(record)
    if(grouping==='plate'){
      if(!plateGroups.has(plateCode))plateGroups.set(plateCode,[])
      plateGroups.get(plateCode).push(record)
    }else createIndividualLabSample({record,createdBy})
  })

  if(grouping==='plate'){
    for(const [plateCode,plateRecords] of plateGroups.entries()){
      const sampleId=nextLabId()
      const first=plateRecords[0]
      plateRecords.forEach(record=>record.sampleId=sampleId)
      createDemoLabSample({
        id:sampleId,workflowType:'environmental_plate',subjectType,environmentalBatchId:id,environmentalSurveillanceCases:plateRecords.map(x=>x.id),
        patient:`Τρυβλίο ${plateCode}`,patientEn:`Plate ${plateCode}`,patientId:id,department:first.department,departmentEn:first.departmentEn,
        type:'environmentalPlate',source:'Τρυβλίο περιβαλλοντικής δειγματοληψίας',sourceEn:'Environmental sampling plate',sourceCode,
        anatomicalSite:`Τρυβλίο ${plateCode}`,plateCode,collectedAt:`${startedAt}T12:00:00`,receivedAt:null,status:'requested',priority:'routine',
        result:null,resultStatus:'draft',critical:false,batchId:id,attachments:[],communications:[],ast:[],
        platePositions:plateRecords.map(record=>({
          surveillanceId:record.id,position:record.platePosition,location:record.location,locationEn:record.locationEn,point:record.point,pointEn:record.pointEn,
          result:null,cfu:'',limitCfu:'',withinLimit:null,organism:'',notes:''
        })),
        timeline:[{at:new Date().toISOString(),type:'environmentalPlateRequested',actor:createdBy}],notes,
      })
    }
  }

  const batch={id,subjectType,startedAt,department,departmentEn,sourceCode,grouping,recordIds:records.map(x=>x.id),sampleIds:[...new Set(records.map(x=>x.sampleId))],status:'active',createdAt:new Date().toISOString(),createdBy}
  environmentalSurveillanceBatches.unshift(batch)
  return batch
}

export function syncEnvironmentalSurveillanceFromLab(){
  environmentalSurveillanceRecords.forEach(record=>{
    const sample=laboratorySamples.find(x=>x.id===record.sampleId)
    if(!sample)return
    if(sample.workflowType==='environmental_plate'){
      const pos=(sample.platePositions||[]).find(x=>x.surveillanceId===record.id)
      if(pos){
        record.result=pos.result||null
        record.cfu=pos.cfu||null
        record.limitCfu=pos.limitCfu||null
        record.withinLimit=pos.withinLimit
        record.organism=pos.organism||null
        record.organisms=pos.organism?[{name:pos.organism}]:[]
      }
      if(sample.finalizedAt)record.status='completed'
    }else if(sample.finalizedAt||sample.resultStatus==='validated'){
      record.status='completed';record.result=sample.result;record.organisms=sample.organisms||[];record.organism=sample.organism||null;record.finalizedAt=sample.finalizedAt||sample.validatedAt||sample.resultedAt
    }
  })
  environmentalSurveillanceBatches.forEach(batch=>{
    const rows=environmentalSurveillanceRecords.filter(x=>x.batchId===batch.id)
    if(rows.length&&rows.every(x=>x.status==='completed'))batch.status='completed'
  })
}

export function getEnvironmentalKpis(){
  syncEnvironmentalSurveillanceFromLab()
  const active=environmentalSurveillanceRecords.filter(x=>x.status==='active').length
  const pendingLab=environmentalSurveillanceRecords.filter(x=>x.status==='active'&&!x.result).length
  const positive=environmentalSurveillanceRecords.filter(x=>x.result==='positive').length
  const outOfLimits=environmentalSurveillanceRecords.filter(x=>x.withinLimit===false).length
  return {active,pendingLab,positive,outOfLimits}
}
