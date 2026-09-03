import fs from 'node:fs'

function patch(path){
  let s=fs.readFileSync(path,'utf8')
  const open='<fieldset className="platform-record-edit-fieldset" disabled={!editing}>'
  if(!s.includes(open)) throw new Error(`${path}: locked fieldset open not found`)
  s=s.replace(open,"<div className={`platform-record-edit-fieldset ${editing?'is-editing':'is-locked'}`}>")
  const close='</div></fieldset>'
  if(!s.includes(close)) throw new Error(`${path}: locked fieldset close not found`)
  s=s.replace(close,'</div></div>')
  fs.writeFileSync(path,s)
}

patch('src/features/platform/PlatformOrganizationRecord.jsx')
patch('src/features/platform/PlatformDemoRecord.jsx')

const cssPath='src/styles/design-system-layouts.css'
let css=fs.readFileSync(cssPath,'utf8')
const marker='/* Platform Owner · functional lock without disabling edit actions */'
if(!css.includes(marker)) css+=`\n\n${marker}\n.platform-record-edit-fieldset.is-locked input,\n.platform-record-edit-fieldset.is-locked select,\n.platform-record-edit-fieldset.is-locked textarea{\n  pointer-events:none;\n  background:var(--lo-color-surface-soft,#f6f8fb);\n  color:var(--lo-color-text);\n  cursor:default;\n  opacity:1\n}\n.platform-record-edit-fieldset.is-locked .location-autocomplete-field input{pointer-events:none}\n.platform-record-edit-fieldset.is-editing input,\n.platform-record-edit-fieldset.is-editing select,\n.platform-record-edit-fieldset.is-editing textarea{pointer-events:auto}\n.platform-demo-create-dialog .observer-dialog-body{padding-bottom:18px!important}\n.platform-demo-create-dialog .platform-form-shell{padding-bottom:4px}\n.platform-demo-create-dialog footer{padding-top:14px!important}\n`
fs.writeFileSync(cssPath,css)
