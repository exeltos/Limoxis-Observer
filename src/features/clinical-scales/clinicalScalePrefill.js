const firstValue=(sources,keys)=>{for(const source of sources){if(!source)continue;for(const key of keys){const value=source[key];if(value!==undefined&&value!==null&&value!=='')return value}}return undefined}

const FIELD_SOURCES={
 temperature:['temperature','temperature_c','temp'],
 map:['map','mean_arterial_pressure','meanArterialPressure'],
 heartRate:['heartRate','heart_rate','pulse'],
 respiratoryRate:['respiratoryRate','respiratory_rate'],
 fio2:['fio2','fiO2'],
 pao2:['pao2','paO2'],
 aado2:['aado2','aa_do2'],
 ph:['ph','arterial_ph'],
 sodium:['sodium','na'],
 potassium:['potassium','k'],
 creatinine:['creatinine'],
 hematocrit:['hematocrit','hct'],
 wbc:['wbc','white_blood_cells'],
 platelets:['platelets','plt'],
 bilirubin:['bilirubin'],
 gcs:['gcs','glasgow_coma_scale'],
 urineOutput24h:['urineOutput24h','urine_output_24h'],
 pao2Fio2:['pao2Fio2','pao2_fio2_ratio']
}

export function clinicalScalePrefill(scaleKey,{patient,admission,clinicalData,latestLabs,latestVitals}={}){
 const sources=[clinicalData,latestVitals,latestLabs,admission,patient]
 const allowed=scaleKey==='sofa'?['pao2Fio2','platelets','bilirubin','map','gcs','creatinine','urineOutput24h']:scaleKey==='apache-ii'?['temperature','map','heartRate','respiratoryRate','fio2','pao2','aado2','ph','sodium','potassium','creatinine','hematocrit','wbc','gcs']:[]
 return Object.fromEntries(allowed.flatMap(key=>{const value=firstValue(sources,FIELD_SOURCES[key]);return value===undefined?[]:[[key,value]]}))
}

export function mergeClinicalScalePrefill(current={},prefill={}){
 return {...prefill,...Object.fromEntries(Object.entries(current).filter(([,value])=>value!==''&&value!==null&&value!==undefined))}
}
