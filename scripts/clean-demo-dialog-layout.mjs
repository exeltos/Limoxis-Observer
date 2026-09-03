import fs from 'node:fs'

const p='src/styles/design-system-layouts.css'
let css=fs.readFileSync(p,'utf8')

function removeBetween(startMarker,endMarker){
  const start=css.indexOf(startMarker)
  if(start<0) return
  const end=css.indexOf(endMarker,start)
  if(end<0) throw new Error(`Missing end marker after ${startMarker}`)
  css=css.slice(0,start)+css.slice(end)
}

// Remove the original demo dialog block before the user-record geometry section.
removeBetween('/* Platform Owner · demo create dialog: scroll the overlay, never the card body */','/* Platform Owner · refined user record geometry */')

// Remove later mutually conflicting demo-dialog blocks.
for(const marker of ['/* Platform Owner · demo footer clearance */','/* Platform Owner · stable demo dialog viewport contract */']){
  const start=css.indexOf(marker)
  if(start>=0){
    const next=css.indexOf('\n/* ',start+marker.length)
    css=css.slice(0,start)+(next>=0?css.slice(next+1):'')
  }
}

// Remove the three leftover one-off declarations from the functional-lock block.
css=css.replace(/\n\.platform-demo-create-dialog \.observer-dialog-body\{padding-bottom:18px!important\}/g,'')
css=css.replace(/\n\.platform-demo-create-dialog \.platform-form-shell\{padding-bottom:4px\}/g,'')
css=css.replace(/\n\.platform-demo-create-dialog footer\{padding-top:14px!important\}/g,'')

const canonical=`

/* Platform Owner · canonical Demo create dialog */
.modal-backdrop:has(.platform-demo-create-dialog){
  align-items:center;
  overflow:hidden;
  padding:16px;
}
.platform-demo-create-dialog{
  width:min(var(--lo-dialog-workspace,1280px),calc(100vw - 32px))!important;
  max-height:calc(100dvh - 32px)!important;
  display:flex!important;
  flex-direction:column!important;
  margin:auto!important;
  overflow:hidden!important;
}
.platform-demo-create-dialog .observer-dialog-body{
  flex:1 1 auto!important;
  min-width:0!important;
  min-height:0!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  padding-bottom:24px!important;
}
.platform-demo-create-dialog .platform-form-shell,
.platform-demo-create-dialog .platform-form-section,
.platform-demo-create-dialog .platform-form-grid{min-width:0}
.platform-demo-create-dialog .platform-form-grid>*{min-width:0}
.platform-demo-create-dialog .platform-form-shell{padding-bottom:0!important}
.platform-demo-create-dialog .platform-form-shell>.platform-form-section:last-child{margin-bottom:0!important}
.platform-demo-create-dialog footer{
  position:static!important;
  inset:auto!important;
  z-index:2!important;
  flex:0 0 auto!important;
  margin:0!important;
  padding:14px 20px!important;
  background:var(--lo-color-surface)!important;
  border-top:1px solid var(--lo-color-border)!important;
  box-shadow:none!important;
}
@media(max-width:760px){
  .modal-backdrop:has(.platform-demo-create-dialog){padding:8px}
  .platform-demo-create-dialog{
    width:calc(100vw - 16px)!important;
    max-height:calc(100dvh - 16px)!important;
  }
  .platform-demo-create-dialog footer{padding:12px 14px!important}
}
`

css=css.trimEnd()+canonical+'\n'
fs.writeFileSync(p,css)
