import { describe,expect,it } from 'vitest'
import { ISHIKAWA_CATEGORIES,analysisProgress,cleanAnalysis,normalizeAnalysis } from '../src/features/quality/rootCauseAnalysis'

describe('CAPA root cause analysis',()=>{
 it('fills every field of a missing or partial analysis',()=>{
  const value=normalizeAnalysis({whys:['a'],causes:{people:['x',''],unknown:['y']}})
  expect(value.whys).toEqual(['a','','','',''])
  expect(Object.keys(value.causes)).toEqual(ISHIKAWA_CATEGORIES.map(([key])=>key))
  expect(value.causes.people).toEqual(['x'])
  expect(normalizeAnalysis(null).problem).toBe('')
 })
 it('reports progress and cleans what was typed',()=>{
  expect(analysisProgress(null)).toEqual({whys:0,causes:0,concluded:false,started:false})
  const cleaned=cleanAnalysis({problem:' p ',whys:[' w1 ','','',' ',''],causes:{methods:[' m ',' ']},rootCause:' r '},{actorName:'A',now:'T'})
  expect(cleaned).toMatchObject({problem:'p',rootCause:'r',updatedAt:'T',updatedBy:'A'})
  expect(cleaned.causes.methods).toEqual(['m'])
  expect(analysisProgress(cleaned)).toEqual({whys:1,causes:1,concluded:true,started:true})
 })
})
