import { describe,expect,it } from 'vitest'
import { createConversationContext,resolveConversationContext } from '../src/features/lira/liraConversation'

describe('LIRA conversational context',()=>{
 it('inherits period comparison for a why follow-up',()=>{
  const previous=createConversationContext({plan:{intent:'comparison',topic:'general',department:'ΜΕΘ',entity:null},comparisonSpec:{mode:'period',current:{label:'September'},reference:{label:'August'}},answer:{title:'Τι άλλαξε;'}})
  const resolved=resolveConversationContext('Γιατί;',{plan:{intent:'explanation',topic:'general',department:'ΜΕΘ',entity:null},comparisonSpec:null,haiType:null,previousContext:previous})
  expect(resolved.plan.intent).toBe('explanation')
  expect(resolved.comparisonSpec?.mode).toBe('period')
 })
 it('keeps HAI subject when asking why',()=>{
  const previous=createConversationContext({plan:{intent:'comparison',topic:'general',department:'ΜΕΘ',entity:null},comparisonSpec:{mode:'period'},haiType:'clabsi',answer:{title:'CLABSI'}})
  const resolved=resolveConversationContext('Γιατί αυξήθηκε;',{plan:{intent:'explanation',topic:'general',department:'ΜΕΘ',entity:null},comparisonSpec:null,haiType:null,previousContext:previous})
  expect(resolved.haiType).toBe('clabsi')
  expect(resolved.plan.intent).toBe('explanation')
 })
 it('allows a new department while retaining subject',()=>{
  const previous=createConversationContext({plan:{intent:'trend',topic:'infections',department:'ΜΕΘ',entity:'klebsiella'},answer:{title:'Klebsiella'}})
  const resolved=resolveConversationContext('Και στην Παθολογική;',{plan:{intent:'trend',topic:'infections',department:'Παθολογική',entity:'klebsiella'},comparisonSpec:null,haiType:null,previousContext:previous})
  expect(resolved.plan.department).toBe('Παθολογική')
  expect(resolved.plan.entity).toBe('klebsiella')
 })
})
