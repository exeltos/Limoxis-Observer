import { loadSnapshot, saveSnapshot } from '../../core/data/repository'
import { patientDemoData } from './patientDemoData'

export function loadPatients(){
  return loadSnapshot('patients', patientDemoData)
}

export function savePatients(rows){
  return saveSnapshot('patients', rows)
}

function nextPatientId(existing){
  const maxNumber=existing.reduce((max,item)=>{
    const number=Number(String(item.id||'').replace(/\D/g,''))
    return Number.isFinite(number)?Math.max(max,number):max
  },260000)
  return `PT-${String(maxNumber+1).slice(-6)}`
}

export function createPatient(existing, data){
  const record={id:nextPatientId(existing),status:'active',...data}
  const list=[record,...existing]
  savePatients(list)
  return {record,list}
}
