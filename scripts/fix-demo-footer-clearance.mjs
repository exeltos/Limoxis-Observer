import fs from 'node:fs'
const p='src/styles/design-system-layouts.css'
let css=fs.readFileSync(p,'utf8')
const marker='/* Platform Owner · demo footer clearance */'
if(!css.includes(marker)) css+=`\n\n${marker}\n.platform-demo-create-dialog{display:flex!important;flex-direction:column!important}\n.platform-demo-create-dialog .observer-dialog-body{flex:0 0 auto!important;padding-bottom:34px!important}\n.platform-demo-create-dialog .platform-form-shell>.platform-form-section:last-child{margin-bottom:18px!important}\n.platform-demo-create-dialog footer{position:relative!important;inset:auto!important;flex:0 0 auto!important;margin-top:0!important;padding:16px 20px!important;background:var(--lo-color-surface)!important;border-top:1px solid var(--lo-color-border)!important}\n.platform-demo-create-dialog .platform-demo-contact-grid{padding-bottom:4px}\n@media(max-height:760px){.platform-demo-create-dialog .observer-dialog-body{padding-bottom:42px!important}}\n`
fs.writeFileSync(p,css)
