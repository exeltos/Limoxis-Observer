import fs from 'node:fs'

function patch(path, pairs){
  let s=fs.readFileSync(path,'utf8')
  for(const [from,to,label] of pairs){
    if(!s.includes(from)) throw new Error(`${path}: missing ${label}`)
    s=s.replace(from,to)
  }
  fs.writeFileSync(path,s)
}

patch('src/features/platform/PlatformOrganizationRecord.jsx',[
  ["<Button variant=\"secondary\" onClick={()=>setEditing(true)}><Pencil size={15}/>{tx('Επεξεργασία','Edit')}</Button>","<IconButton tone=\"edit\" label={tx('Επεξεργασία','Edit')} onClick={()=>setEditing(true)}><Pencil size={16}/></IconButton>",'org pencil only']
])

patch('src/features/platform/PlatformDemoRecord.jsx',[
  ["<Button variant=\"secondary\" onClick={()=>setEditing(true)}><Pencil size={15}/>{tx('Επεξεργασία','Edit')}</Button>","<IconButton tone=\"edit\" label={tx('Επεξεργασία','Edit')} onClick={()=>setEditing(true)}><Pencil size={16}/></IconButton>",'demo pencil only']
])

patch('src/features/workspaces/PlatformCenterPage.jsx',[
  ["<ObserverDialog\n            width=\"wide\"\n            eyebrow=\"Platform Owner\"\n            title={tx('Νέο Demo', 'New Demo')}","<ObserverDialog\n            width=\"workspace\"\n            className=\"platform-demo-create-dialog\"\n            eyebrow=\"Platform Owner\"\n            title={tx('Νέο Demo', 'New Demo')}",'demo dialog class']
])

const cssPath='src/styles/design-system-layouts.css'
let css=fs.readFileSync(cssPath,'utf8')
const marker='/* Platform Owner · demo create dialog: scroll the overlay, never the card body */'
if(!css.includes(marker)) css+=`\n\n${marker}\n.modal-backdrop:has(.platform-demo-create-dialog){\n  align-items:flex-start;\n  overflow-y:auto;\n  overflow-x:hidden;\n  padding:24px\n}\n.platform-demo-create-dialog{\n  width:min(var(--lo-dialog-workspace,1280px),calc(100vw - 48px))!important;\n  max-height:none!important;\n  margin:auto;\n  overflow:visible!important\n}\n.platform-demo-create-dialog .observer-dialog-body{\n  min-width:0;\n  overflow:visible!important\n}\n.platform-demo-create-dialog .platform-form-shell,\n.platform-demo-create-dialog .platform-form-section,\n.platform-demo-create-dialog .platform-form-grid{min-width:0}\n.platform-demo-create-dialog .platform-form-grid>*{min-width:0}\n.platform-demo-create-dialog footer{position:static}\n.platform-record-edit-toolbar>.entity-record-icon-button{margin-left:auto}\n@media(max-width:760px){\n  .modal-backdrop:has(.platform-demo-create-dialog){padding:10px}\n  .platform-demo-create-dialog{width:calc(100vw - 20px)!important}\n}\n`
fs.writeFileSync(cssPath,css)
