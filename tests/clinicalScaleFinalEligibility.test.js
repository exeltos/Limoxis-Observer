import {describe,expect,it} from 'vitest'
import {isClinicalScaleEligible} from '../src/features/clinical-scales/clinicalScaleContext'

const base={status:'approved',orgSetting:{enabled:true,availability:'available'}}
describe('clinical scale final eligibility audit',()=>{
 it('uses population as a first-class eligibility rule',()=>{expect(isClinicalScaleEligible({...base,population:['adult'],settings:[]},{age:12})).toBe(false);expect(isClinicalScaleEligible({...base,population:['pediatric'],settings:[]},{age:12})).toBe(true)})
 it('treats infants under one as neonatal for governed neonatal tools',()=>expect(isClinicalScaleEligible({...base,population:['neonatal'],settings:[]},{age:0})).toBe(true))
 it('uses explicit setting aliases instead of substring matching',()=>{expect(isClinicalScaleEligible({...base,population:['adult'],settings:['icu']},{age:55,admission:{department_name:'ΜΕΘ'}})).toBe(true);expect(isClinicalScaleEligible({...base,population:['adult'],settings:['icu']},{age:55,admission:{department_name:'Παθολογική Κλινική'}})).toBe(false)})
})
