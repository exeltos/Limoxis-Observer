import {describe,expect,it} from 'vitest'
import {clinicalScalePrefill,mergeClinicalScalePrefill} from '../src/features/clinical-scales/clinicalScalePrefill'

describe('clinical scale prefill',()=>{
 it('maps existing vitals and labs into APACHE II without inventing values',()=>{
  expect(clinicalScalePrefill('apache-ii',{latestVitals:{temperature_c:38.2,heart_rate:112},latestLabs:{creatinine:1.8,wbc:14.1}})).toEqual({temperature:38.2,heartRate:112,creatinine:1.8,wbc:14.1})
 })
 it('maps SOFA laboratory values',()=>expect(clinicalScalePrefill('sofa',{latestLabs:{platelets:90,bilirubin:3.1,creatinine:2.2}})).toEqual({platelets:90,bilirubin:3.1,creatinine:2.2}))
 it('never overwrites a clinician-entered value',()=>expect(mergeClinicalScalePrefill({creatinine:1.2},{creatinine:2.1,platelets:100})).toEqual({creatinine:1.2,platelets:100}))
})
