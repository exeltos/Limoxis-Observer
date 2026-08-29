import fs from 'node:fs'
import vm from 'node:vm'

const source=fs.readFileSync('src/core/i18n/LanguageContext.jsx','utf8')

function extractObject(name){
  const marker=`export const ${name} =`
  const startMarker=source.indexOf(marker)
  if(startMarker<0)throw new Error(`Could not find ${name}`)
  const start=source.indexOf('{',startMarker)
  let depth=0, quote=null, escaped=false
  for(let i=start;i<source.length;i++){
    const ch=source[i]
    if(quote){
      if(escaped){escaped=false;continue}
      if(ch==='\\'){escaped=true;continue}
      if(ch===quote){quote=null;continue}
      continue
    }
    if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue}
    if(ch==='{')depth++
    if(ch==='}'){
      depth--
      if(depth===0){
        const text=source.slice(start,i+1)
        return vm.runInNewContext(`(${text})`,Object.create(null),{timeout:1000})
      }
    }
  }
  throw new Error(`Unclosed object ${name}`)
}
function flatten(obj,prefix='',out={}){
  for(const [key,value] of Object.entries(obj||{})){
    const path=prefix?`${prefix}.${key}`:key
    if(value&&typeof value==='object'&&!Array.isArray(value))flatten(value,path,out)
    else out[path]=value
  }
  return out
}
function compare(name,root){
  const el=flatten(root.el),en=flatten(root.en)
  const missingEn=Object.keys(el).filter(k=>!(k in en))
  const missingEl=Object.keys(en).filter(k=>!(k in el))
  const emptyEn=Object.entries(en).filter(([,v])=>typeof v==='string'&&!v.trim()).map(([k])=>k)
  const greek=/[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊϋΐΰ]/
  const greekInEn=Object.entries(en).filter(([,v])=>typeof v==='string'&&greek.test(v)).map(([k,v])=>[k,v])
  return {name,el,en,missingEn,missingEl,emptyEn,greekInEn}
}
const stringsRoot=extractObject('strings')
const productRoot=extractObject('productStrings')
const effective={
 el:{...flatten(stringsRoot.el),...flatten(productRoot.el)},
 en:{...flatten(stringsRoot.en),...flatten(productRoot.en)}
}
const missingEn=Object.keys(effective.el).filter(k=>!(k in effective.en))
const missingEl=Object.keys(effective.en).filter(k=>!(k in effective.el))
const emptyEn=Object.entries(effective.en).filter(([,v])=>typeof v==='string'&&!v.trim()).map(([k])=>k)
const greek=/[Α-Ωα-ωΆΈΉΊΌΎΏάέήίόύώϊϋΐΰ]/
const allowedNativeLanguageNames=new Set(['managementPanel.greekLanguageName'])
const greekInEn=Object.entries(effective.en).filter(([k,v])=>!allowedNativeLanguageNames.has(k)&&typeof v==='string'&&greek.test(v)).map(([k,v])=>[k,v])

console.log(`Effective translations: EL ${Object.keys(effective.el).length} / EN ${Object.keys(effective.en).length}`)
let failed=false
if(missingEn.length){failed=true;console.error(`Missing effective EN (${missingEn.length}): ${missingEn.join(', ')}`)}
if(missingEl.length){console.warn(`EN-only keys (${missingEl.length}): ${missingEl.join(', ')}`)}
if(emptyEn.length){failed=true;console.error(`Empty EN (${emptyEn.length}): ${emptyEn.join(', ')}`)}
if(greekInEn.length){failed=true;console.error(`Greek text in effective EN (${greekInEn.length}): ${greekInEn.map(([k,v])=>`${k}=${v}`).join(' | ')}`)}
if(failed)process.exit(1)
console.log('English translation parity audit passed.')
