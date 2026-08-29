import { helpManual } from '../src/core/help/helpManual.js'
import { helpManualEn } from '../src/core/help/helpManualEn.js'
import { helpExtras } from '../src/core/help/helpExtras.js'

const elKeys=Object.keys(helpManual).sort()
const enKeys=Object.keys(helpManualEn).sort()
const extraKeys=Object.keys(helpExtras).sort()
const greek=/[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊϋΐΰ]/

let failed=false
function fail(message){failed=true;console.error(message)}
if(JSON.stringify(elKeys)!==JSON.stringify(enKeys))fail(`EL/EN manual route mismatch.\nEL: ${elKeys.join(', ')}\nEN: ${enKeys.join(', ')}`)
for(const key of elKeys){
  const el=helpManual[key],en=helpManualEn[key]
  if(!en){fail(`Missing EN manual: ${key}`);continue}
  if(el.chapters.length!==en.chapters.length)fail(`Chapter count mismatch ${key}: EL ${el.chapters.length} / EN ${en.chapters.length}`)
  if(el.steps.length!==en.steps.length)fail(`Step count mismatch ${key}: EL ${el.steps.length} / EN ${en.steps.length}`)
  const enText=JSON.stringify(en)
  if(greek.test(enText))fail(`Greek text found in English manual: ${key}`)
  if(!helpExtras[key])fail(`Missing help extras: ${key}`)
  else{
    if(!helpExtras[key].checks?.el?.length||!helpExtras[key].checks?.en?.length)fail(`Missing bilingual checklist: ${key}`)
    if(!helpExtras[key].tip?.el||!helpExtras[key].tip?.en)fail(`Missing bilingual good-practice note: ${key}`)
  }
}
if(failed)process.exit(1)
console.log(`Help manual coverage passed: ${elKeys.length} role-aware sections, EL/EN parity, checklists and tips.`)
