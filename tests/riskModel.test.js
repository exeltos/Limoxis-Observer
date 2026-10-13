import {describe,expect,it} from 'vitest'
import {compareAssessments,levelForScore,riskScore,riskTrend,riskWarnings,scored,suggestJci,summarizeRisks} from '../src/features/quality/risk/riskModel'

const risk=(over={})=>({code:'R1',process:'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ',scope:'ΜΕΘ',hazard:'Λοίμωξη',inherentL:4,inherentC:5,residualL:3,residualC:5,additionalMeasures:'Επανεκπαίδευση',owner:'Προϊστάμενος',targetL:2,targetC:5,...over})

describe('risk scoring (NHS 5×5)',()=>{
 it('multiplies likelihood by consequence and rejects values outside 1–5',()=>{
  expect(riskScore(3,4)).toBe(12)
  expect(riskScore(0,4)).toBeNull()
  expect(riskScore(6,1)).toBeNull()
  expect(riskScore('2','5')).toBe(10)
 })
 it('uses the NHS bands 1–3 / 4–6 / 8–12 / 15–25',()=>{
  // The source spreadsheet labelled 1×5=5 «Low», 2×4=8 «Moderate» and 3×4=12 «Very high».
  expect([1,3,4,5,6,8,10,12,15,16,25].map(levelForScore)).toEqual(['low','low','moderate','moderate','moderate','high','high','high','very_high','very_high','very_high'])
 })
 it('scores the inherent, residual and target risk separately',()=>{
  const s=scored(risk())
  expect([s.inherent.score,s.residual.score,s.target.score]).toEqual([20,15,10])
  expect([s.inherent.level,s.residual.level,s.target.level]).toEqual(['very_high','very_high','high'])
 })
})

describe('risk warnings',()=>{
 const ids=r=>riskWarnings(r).map(w=>w.id)
 it('asks for an action plan, an owner and a target on a high residual risk',()=>{
  expect(ids(risk({additionalMeasures:'Δ/Α',targetL:null,targetC:null}))).toEqual(['action_plan_required','target_required'])
  expect(ids(risk({owner:''}))).toEqual(['owner_required'])
 })
 it('flags a residual above the inherent risk and a target above the residual',()=>{
  expect(ids(risk({residualL:5,residualC:5,targetL:5,targetC:5}))).toContain('residual_above_inherent')
  expect(ids(risk({targetL:4,targetC:5}))).toContain('target_above_residual')
 })
 it('notes a changed consequence until a reason is written',()=>{
  expect(ids(risk({residualC:4,targetC:4,targetL:2}))).toContain('consequence_changed')
  expect(ids(risk({residualC:4,targetC:4,targetL:2,consequenceRationale:'Άμεση πρόσβαση σε απινιδωτή'}))).not.toContain('consequence_changed')
 })
 it('is quiet on a complete, coherent risk',()=>{expect(ids(risk())).toEqual([])})
})

describe('analysis',()=>{
 const risks=[risk({code:'R1'}),risk({code:'R2',process:'ΤΑΥΤΟΠΟΙΗΣΗ',inherentL:2,inherentC:2,residualL:1,residualC:2,targetL:null,targetC:null,additionalMeasures:'',owner:''}),risk({code:'R3',residualL:2,residualC:4,additionalMeasures:''})]
 const s=summarizeRisks(risks)
 it('counts levels and fills the heat map by consequence row and likelihood column',()=>{
  expect(s.levels.residual).toEqual({low:1,moderate:0,high:1,very_high:1})
  expect(s.heat.residual[4][2]).toBe(1)// C=5, L=3
  expect(s.heat.inherent[4][3]).toBe(2)// C=5, L=4
 })
 it('lists the priorities and the high risks without a plan',()=>{
  expect(s.priorities.map(r=>r.code)).toEqual(['R1','R3'])
  expect(s.withoutPlan.map(r=>r.code)).toEqual(['R3'])
  expect(s.byProcess[0]).toMatchObject({key:'ΑΣΦΑΛΕΙΑ ΑΣΘΕΝΩΝ',count:2,residualMax:15,level:'very_high'})
 })
})

describe('comparison between periods',()=>{
 it('matches a risk by its lineage key and classifies the change',()=>{
  const before=[risk({lineageKey:'A',residualL:4}),risk({lineageKey:'B',residualL:1}),risk({lineageKey:'C'})]
  const now=[risk({lineageKey:'A',residualL:2}),risk({lineageKey:'B',residualL:3}),risk({lineageKey:'D'})]
  const result=compareAssessments(now,before)
  expect(result.counts).toEqual({improved:1,worsened:1,unchanged:0,new:1,removed:1})
  expect(result.rows.find(r=>r.key==='A')).toMatchObject({before:20,current:10,delta:-10,status:'improved'})
 })
 it('orders the trend by assessment date',()=>{
  const trend=riskTrend([{id:'b',periodLabel:'2026-Α',assessedOn:'2026-04-01',risks:[risk()]},{id:'a',periodLabel:'2025-Β',assessedOn:'2025-10-01',risks:[risk({residualL:5,residualC:5})]}])
  expect(trend.map(x=>[x.label,x.residualAverage,x.highOrAbove])).toEqual([['2025-Β',25,1],['2026-Α',15,1]])
 })
})

describe('JCI suggestion',()=>{
 it('maps the wording of a risk to an IPSG goal or chapter',()=>{
  expect(suggestJci('Ανεπιθύμητο συμβάν λόγω μη ορθής ταυτοποίησης του ασθενή')).toBe('IPSG.1')
  expect(suggestJci('Πτώση Ασθενή / Συνέπειες')).toBe('IPSG.6')
  expect(suggestJci('Εμφάνιση Ενδονοσοκομειακής Λοίμωξης')).toBe('IPSG.5')
  expect(suggestJci('Εμφάνιση Πυρκαγιάς σε κοινόχρηστους χώρους')).toBe('FMS')
  expect(suggestJci('Μαιευτική Αιμορραγία')).toBe('COP')
 })
})
