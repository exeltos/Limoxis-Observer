import {describe,expect,it} from 'vitest'
import {isClinicalScaleEligible} from '../src/features/clinical-scales/clinicalScaleContext'
import type { ScaleDefinition } from '../src/features/clinical-scales/clinicalScaleTypes'

describe('expanded clinical scale population eligibility',()=>{
 it('keeps adult ICU tools away from pediatric patients',()=>expect(isClinicalScaleEligible({status:'approved',population:['adult'],min_age_years:18,settings:[],orgSetting:{enabled:true,availability:'available'}} as ScaleDefinition,{age:10})).toBe(false))
 it('allows pediatric tools within governed age range',()=>expect(isClinicalScaleEligible({status:'approved',population:['pediatric'],min_age_years:0,max_age_years:17.999,settings:[],orgSetting:{enabled:true,availability:'available'}} as ScaleDefinition,{age:8})).toBe(true))
})
