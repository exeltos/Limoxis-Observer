import fs from 'node:fs'
import {describe,expect,it} from 'vitest'

const read=p=>fs.readFileSync(p,'utf8')
const printBlocks=css=>css.match(/@media print\{[\s\S]*?\n\}/g)||[]

describe('Printing',()=>{
 it('hides the rest of the page only while a surveillance episode card is printed',()=>{
  // An unscoped `body *{visibility:hidden}` blanked every other print (laboratory sample, records).
  const css=read('src/styles/foundation.css')
  expect(css).not.toMatch(/@media print\{\s*body \*\{visibility:hidden\}/)
  expect(css).toContain('body:has(.episode-detail-card) *{visibility:hidden}')
 })
 it('prints a record page without the app chrome and without the scrolling frame',()=>{
  const css=read('src/styles/print.css')
  expect(printBlocks(css)).toHaveLength(1)
  expect(css).toMatch(/\.sidebar,\.topbar[^}]*\):not\(#print-root\)\{display:none!important/)
  expect(css).toMatch(/\.entity-record-body\):not\(#print-root\)\{[^}]*overflow:visible!important/)
  expect(read('src/main.jsx')).toContain("import './styles/print.css'")
 })
 it('shows the print button of the clinical assessment report and prints the report alone',()=>{
  const panel=read('src/features/clinical-scales/PatientClinicalScalesPanel.jsx')
  // DialogActions renders its children; an `extra` prop was silently dropped.
  expect(panel).not.toMatch(/<DialogActions[^>]*extra=/)
  expect(panel).toContain('printElement(reportRef.current')
  expect(panel).not.toContain('window.print()')
 })
})

describe('printElement',()=>{
 it('copies the element and the stylesheets into a window that prints itself',async()=>{
  const written=[];let printed=false
  const win={document:{open(){},write:html=>written.push(html),close(){}},focus(){},print:()=>{printed=true}}
  globalThis.window={open:()=>win}
  globalThis.document={title:'App',baseURI:'https://example.test/',documentElement:{lang:'el'},querySelectorAll:()=>[{outerHTML:'<link rel="stylesheet" href="/assets/app.css">'}]}
  const {printElement}=await import('../src/design-system/printElement.js')
  const ok=printElement({outerHTML:'<div class="report">12</div>'},{title:'GCS <b>',heading:['Αναφορά','Ιωαννίδη · PT-1']})
  expect(ok).toBe(true)
  expect(written[0]).toContain('<link rel="stylesheet" href="/assets/app.css">')
  expect(written[0]).toContain('<div class="report">12</div>')
  expect(written[0]).toContain('<title>GCS &lt;b&gt;</title>')
  expect(written[0]).toContain('Ιωαννίδη · PT-1')
  await new Promise(r=>setTimeout(r,450))
  expect(printed).toBe(true)
  expect(printElement(null)).toBe(false)
  delete globalThis.window;delete globalThis.document
 })
})
