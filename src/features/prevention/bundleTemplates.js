import { SYSTEM_BUNDLE_LIBRARY,publishedBundleTemplates,loadBundleLibrary } from '../management/bundleLibraryData'

function toExecutionTemplate(x){
 return {...x,title:x.titleEl,elements:x.elements.map(e=>[e.id,e.labelEl])}
}
export const BUNDLE_TEMPLATES=publishedBundleTemplates().map(toExecutionTemplate)
export function loadPublishedBundleTemplates(){return publishedBundleTemplates(loadBundleLibrary()).map(toExecutionTemplate)}
export function getBundleTemplate(id,library=null){
 const source=library?publishedBundleTemplates(library):publishedBundleTemplates(loadBundleLibrary())
 const item=source.find(x=>x.id===id)||source[0]||SYSTEM_BUNDLE_LIBRARY[0]
 return toExecutionTemplate(item)
}
export function bundleScore(answers={}){
 const applicable=Object.values(answers).filter(x=>x==='yes'||x==='no')
 if(!applicable.length)return null
 const yes=applicable.filter(x=>x==='yes').length
 return Math.round(yes/applicable.length*100)
}
export function bundleAllOrNone(answers={}){
 const applicable=Object.values(answers).filter(x=>x==='yes'||x==='no')
 return applicable.length>0&&applicable.every(x=>x==='yes')
}
