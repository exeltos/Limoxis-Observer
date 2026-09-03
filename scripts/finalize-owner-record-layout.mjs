import fs from 'node:fs'

function patch(path, pairs){
  let s=fs.readFileSync(path,'utf8')
  for(const [from,to,label] of pairs){
    if(!s.includes(from)) throw new Error(`${path}: missing ${label}`)
    s=s.replace(from,to)
  }
  fs.writeFileSync(path,s)
}

for(const path of ['src/features/platform/PlatformOrganizationRecord.jsx','src/features/platform/PlatformDemoRecord.jsx']){
  patch(path,[
    ["function FormSection({title,subtitle,children}){return <section className=\"platform-form-section\"><header><strong>{title}</strong>{subtitle&&<span>{subtitle}</span>}</header>{children}</section>}","function FormSection({title,subtitle,actions,children}){return <section className=\"platform-form-section\"><header><div><strong>{title}</strong>{subtitle&&<span>{subtitle}</span>}</div>{actions&&<div className=\"platform-form-section-actions\">{actions}</div>}</header>{children}</section>}",'FormSection actions']
  ])
}

patch('src/features/platform/PlatformOrganizationRecord.jsx',[
  ["{initialTab==='details'&&<div className=\"platform-owner-details platform-organization-record-form\"><div className=\"platform-record-edit-toolbar\">{editing?<><Button variant=\"secondary\" onClick={()=>{setDraft(toDraft(record));setEditing(false)}} disabled={saving}><X size={15}/>{tx('Ακύρωση','Cancel')}</Button><Button onClick={saveOrganization} disabled={!canSave||saving||working}><Save size={15}/>{saving?tx('Αποθήκευση…','Saving…'):tx('Αποθήκευση','Save')}</Button></>:<IconButton tone=\"edit\" label={tx('Επεξεργασία','Edit')} onClick={()=>setEditing(true)}><Pencil size={16}/></IconButton>}</div><fieldset className=\"platform-record-edit-fieldset\" disabled={!editing}><div className=\"platform-form-shell\">\n      <FormSection title={tx('Ταυτότητα οργανισμού','Organization identity')}>","{initialTab==='details'&&<div className=\"platform-owner-details platform-organization-record-form\"><fieldset className=\"platform-record-edit-fieldset\" disabled={!editing}><div className=\"platform-form-shell\">\n      <FormSection title={tx('Ταυτότητα οργανισμού','Organization identity')} actions={editing?<><Button variant=\"secondary\" onClick={()=>{setDraft(toDraft(record));setEditing(false)}} disabled={saving}><X size={15}/>{tx('Ακύρωση','Cancel')}</Button><Button onClick={saveOrganization} disabled={!canSave||saving||working}><Save size={15}/>{saving?tx('Αποθήκευση…','Saving…'):tx('Αποθήκευση','Save')}</Button></>:<IconButton tone=\"edit\" label={tx('Επεξεργασία','Edit')} onClick={()=>setEditing(true)}><Pencil size={16}/></IconButton>}>",'organization inline actions']
])

patch('src/features/platform/PlatformDemoRecord.jsx',[
  ["<div className=\"platform-record-edit-toolbar\">{editing?<><Button variant=\"secondary\" onClick={()=>{setDraft(toDraft(record));setEditing(false)}} disabled={saving}><X size={15}/>{tx('Ακύρωση','Cancel')}</Button><Button onClick={saveEdit} disabled={!canSave||saving||working}><Save size={15}/>{saving?tx('Αποθήκευση…','Saving…'):tx('Αποθήκευση','Save')}</Button></>:<IconButton tone=\"edit\" label={tx('Επεξεργασία','Edit')} onClick={()=>setEditing(true)}><Pencil size={16}/></IconButton>}</div>\n        <fieldset className=\"platform-record-edit-fieldset\" disabled={!editing}><div className=\"platform-form-shell\">\n          <FormSection title={tx('Ταυτότητα Demo οργανισμού','Demo organization identity')} subtitle={tx('Τα στοιχεία αυτά ανήκουν στον απομονωμένο Demo οργανισμό.','These details belong to the isolated Demo organization.')}>","<fieldset className=\"platform-record-edit-fieldset\" disabled={!editing}><div className=\"platform-form-shell\">\n          <FormSection title={tx('Ταυτότητα Demo οργανισμού','Demo organization identity')} subtitle={tx('Τα στοιχεία αυτά ανήκουν στον απομονωμένο Demo οργανισμό.','These details belong to the isolated Demo organization.')} actions={editing?<><Button variant=\"secondary\" onClick={()=>{setDraft(toDraft(record));setEditing(false)}} disabled={saving}><X size={15}/>{tx('Ακύρωση','Cancel')}</Button><Button onClick={saveEdit} disabled={!canSave||saving||working}><Save size={15}/>{saving?tx('Αποθήκευση…','Saving…'):tx('Αποθήκευση','Save')}</Button></>:<IconButton tone=\"edit\" label={tx('Επεξεργασία','Edit')} onClick={()=>setEditing(true)}><Pencil size={16}/></IconButton>}>",'demo inline actions']
])

const cssPath='src/styles/design-system-layouts.css'
let css=fs.readFileSync(cssPath,'utf8')
css+=`\n\n/* Platform Owner · final record interaction geometry */\n.platform-form-section>header{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;min-height:42px}\n.platform-form-section>header>div:first-child{display:flex;min-width:0;flex-direction:column;gap:4px}\n.platform-form-section-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 0 auto}\n.platform-form-section-actions .button{min-height:40px}\n.platform-form-section-actions .entity-record-icon-button{flex:0 0 auto}\n.platform-owner-users{overflow:visible!important}\n.platform-owner-users>.scroll-table{overflow-x:auto;overflow-y:visible;max-height:none!important}\n.platform-user-management-panel{overflow:visible}\n.platform-user-management-panel>.scroll-table{overflow:visible!important}\n.platform-demo-contact-grid{grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)!important}\n.platform-demo-contact-grid>.field-wide{grid-column:auto!important}\n.platform-demo-contact-grid>.manual-date-field{min-width:0}\n.platform-demo-contact-grid input{min-width:0;width:100%}\n@media(max-width:760px){.platform-demo-contact-grid{grid-template-columns:1fr!important}.platform-form-section>header{align-items:flex-start}.platform-form-section-actions{flex-wrap:wrap}}\n`
fs.writeFileSync(cssPath,css)
