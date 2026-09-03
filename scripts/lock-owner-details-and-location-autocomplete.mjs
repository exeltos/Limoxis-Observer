import fs from 'node:fs'

function mustReplace(source,search,replacement,label){
  if(!source.includes(search)) throw new Error(`Missing ${label}`)
  return source.replace(search,replacement)
}

// PlatformCenterPage: shared autocomplete in create forms + wider contact/admin fields.
{
  const path='src/features/workspaces/PlatformCenterPage.jsx'
  let s=fs.readFileSync(path,'utf8')
  s=mustReplace(s,"import { ManualDateField } from '../../design-system/ManualDateField'","import { ManualDateField } from '../../design-system/ManualDateField'\nimport { LocationAutocompleteField } from '../../design-system/LocationAutocompleteField'\nimport { CITY_OPTIONS,COUNTRY_OPTIONS } from '../../core/reference/locationOptions'",'center imports')
  s=mustReplace(s,"<label className=\"field\">\n              <span>{tx('Πόλη', 'City')} *</span>\n              <input value={draft.city} onChange={event => setField('city', event.target.value)} />\n            </label>\n            <label className=\"field\">\n              <span>{tx('Χώρα', 'Country')}</span>\n              <input value={draft.country} onChange={event => setField('country', event.target.value)} />\n            </label>","<LocationAutocompleteField label={tx('Πόλη','City')} required value={draft.city} onChange={value=>setField('city',value)} options={CITY_OPTIONS} />\n            <LocationAutocompleteField label={tx('Χώρα','Country')} value={draft.country} onChange={value=>setField('country',value)} options={COUNTRY_OPTIONS} />",'new organization city country')
  s=mustReplace(s,"<label className=\"field\">\n              <span>{tx('Ονοματεπώνυμο', 'Full name')} *</span>","<label className=\"field field-wide\">\n              <span>{tx('Ονοματεπώνυμο', 'Full name')} *</span>",'new organization admin name width')
  s=mustReplace(s,"<label className=\"field\">\n              <span>{tx('Email πρόσκλησης', 'Invitation email')} *</span>","<label className=\"field field-wide\">\n              <span>{tx('Email πρόσκλησης', 'Invitation email')} *</span>",'new organization admin email width')
  s=mustReplace(s,"<label className=\"field\"><span>{tx('Πόλη', 'City')}</span><input value={demoDraft.city} onChange={event => setDemoDraft(current => ({ ...current, city: event.target.value }))} /></label>\n                  <label className=\"field\"><span>{tx('Χώρα', 'Country')}</span><input value={demoDraft.country} onChange={event => setDemoDraft(current => ({ ...current, country: event.target.value }))} /></label>","<LocationAutocompleteField label={tx('Πόλη','City')} value={demoDraft.city} onChange={value=>setDemoDraft(current=>({...current,city:value}))} options={CITY_OPTIONS} />\n                  <LocationAutocompleteField label={tx('Χώρα','Country')} value={demoDraft.country} onChange={value=>setDemoDraft(current=>({...current,country:value}))} options={COUNTRY_OPTIONS} />",'new demo city country')
  s=mustReplace(s,"<div className=\"platform-form-grid\">\n                  <label className=\"field\"><span>{tx('Υπεύθυνος επικοινωνίας', 'Contact person')}</span>","<div className=\"platform-form-grid platform-demo-contact-grid\">\n                  <label className=\"field field-wide\"><span>{tx('Υπεύθυνος επικοινωνίας', 'Contact person')}</span>",'new demo contact width')
  s=mustReplace(s,"<label className=\"field\"><span>{tx('Email πρόσκλησης', 'Invitation email')} *</span><input type=\"email\" value={demoDraft.contactEmail}","<label className=\"field field-wide\"><span>{tx('Email πρόσκλησης', 'Invitation email')} *</span><input type=\"email\" value={demoDraft.contactEmail}",'new demo email width')
  fs.writeFileSync(path,s)
}

// Organization record: locked by default, pencil unlocks, save/cancel in form, autocomplete city/country.
{
  const path='src/features/platform/PlatformOrganizationRecord.jsx'
  let s=fs.readFileSync(path,'utf8')
  s=mustReplace(s,"import { Activity,BarChart3,Building2,KeyRound,LogIn,PauseCircle,PlayCircle,Save,Send,Trash2,Users } from 'lucide-react'","import { Activity,BarChart3,Building2,KeyRound,LogIn,PauseCircle,Pencil,PlayCircle,Save,Send,Trash2,Users,X } from 'lucide-react'",'org icons')
  s=mustReplace(s,"import { IconButton } from '../../design-system/IconButton'","import { IconButton } from '../../design-system/IconButton'\nimport { LocationAutocompleteField } from '../../design-system/LocationAutocompleteField'\nimport { CITY_OPTIONS,COUNTRY_OPTIONS } from '../../core/reference/locationOptions'",'org location imports')
  s=mustReplace(s,"  const [selectedUserId,setSelectedUserId]=useState('')","  const [selectedUserId,setSelectedUserId]=useState('')\n  const [editing,setEditing]=useState(false)",'org editing state')
  s=mustReplace(s,"useEffect(()=>{setRecord(organization);setDraft(toDraft(organization))},[organization])","useEffect(()=>{setRecord(organization);setDraft(toDraft(organization));setEditing(false)},[organization])",'org reset editing')
  s=mustReplace(s,"onChanged?.(next);notify(tx('Τα στοιχεία του οργανισμού ενημερώθηκαν.'","onChanged?.(next);setEditing(false);notify(tx('Τα στοιχεία του οργανισμού ενημερώθηκαν.'",'org save lock')
  s=s.replace(/\n    <Action icon=\{<Save size=\{17\}\/\>} tone="edit"[^\n]+onClick=\{saveOrganization\}\/\>/,'')
  s=mustReplace(s,"{initialTab==='details'&&<div className=\"platform-owner-details platform-organization-record-form\"><div className=\"platform-form-shell\">","{initialTab==='details'&&<div className=\"platform-owner-details platform-organization-record-form\"><div className=\"platform-record-edit-toolbar\">{editing?<><Button variant=\"secondary\" onClick={()=>{setDraft(toDraft(record));setEditing(false)}} disabled={saving}><X size={15}/>{tx('Ακύρωση','Cancel')}</Button><Button onClick={saveOrganization} disabled={!canSave||saving||working}><Save size={15}/>{saving?tx('Αποθήκευση…','Saving…'):tx('Αποθήκευση','Save')}</Button></>:<Button variant=\"secondary\" onClick={()=>setEditing(true)}><Pencil size={15}/>{tx('Επεξεργασία','Edit')}</Button>}</div><fieldset className=\"platform-record-edit-fieldset\" disabled={!editing}><div className=\"platform-form-shell\">",'org details toolbar')
  s=mustReplace(s,"      </FormSection>\n    </div></div>}","      </FormSection>\n    </div></fieldset></div>}",'org details fieldset close')
  s=s.replace(/<label className="field"><span>\{tx\('Πόλη','City'\)\}<\/span><input value=\{draft\.city\} onChange=\{e=>setDraft\(x=>\(\{\.\.\.x,city:e\.target\.value\}\)\)\}\/><\/label><label className="field"><span>\{tx\('Χώρα','Country'\)\}<\/span><input value=\{draft\.country\} onChange=\{e=>setDraft\(x=>\(\{\.\.\.x,country:e\.target\.value\}\)\)\}\/><\/label>/,"<LocationAutocompleteField label={tx('Πόλη','City')} value={draft.city} onChange={value=>setDraft(x=>({...x,city:value}))} options={CITY_OPTIONS}/><LocationAutocompleteField label={tx('Χώρα','Country')} value={draft.country} onChange={value=>setDraft(x=>({...x,country:value}))} options={COUNTRY_OPTIONS}/>")
  fs.writeFileSync(path,s)
}

// Demo record: same locked/editable details pattern + autocomplete + wider contact fields.
{
  const path='src/features/platform/PlatformDemoRecord.jsx'
  let s=fs.readFileSync(path,'utf8')
  s=mustReplace(s,"import { Building2,FlaskConical,KeyRound,LogIn,PauseCircle,PlayCircle,Save,Trash2 } from 'lucide-react'","import { Building2,FlaskConical,KeyRound,LogIn,PauseCircle,Pencil,PlayCircle,Save,Trash2,X } from 'lucide-react'",'demo icons')
  s=mustReplace(s,"import { ManualDateField } from '../../design-system/ManualDateField'","import { ManualDateField } from '../../design-system/ManualDateField'\nimport { LocationAutocompleteField } from '../../design-system/LocationAutocompleteField'\nimport { CITY_OPTIONS,COUNTRY_OPTIONS } from '../../core/reference/locationOptions'",'demo location imports')
  s=mustReplace(s,"  const [deletePassword,setDeletePassword]=useState('')","  const [deletePassword,setDeletePassword]=useState('')\n  const [editing,setEditing]=useState(false)",'demo editing state')
  s=mustReplace(s,"    setDraft(toDraft(demo))","    setDraft(toDraft(demo))\n    setEditing(false)",'demo reset editing')
  s=mustReplace(s,"setDraft(toDraft(next));onChanged?.(next);notify(tx('Η καρτέλα Demo ενημερώθηκε.'","setDraft(toDraft(next));setEditing(false);onChanged?.(next);notify(tx('Η καρτέλα Demo ενημερώθηκε.'",'demo save lock')
  s=s.replace(/\n    <Action icon=\{<Save size=\{17\}\/\>} tone="edit"[^\n]+onClick=\{saveEdit\}\/\>/,'')
  s=mustReplace(s,"        <div className=\"platform-form-shell\">","        <div className=\"platform-record-edit-toolbar\">{editing?<><Button variant=\"secondary\" onClick={()=>{setDraft(toDraft(record));setEditing(false)}} disabled={saving}><X size={15}/>{tx('Ακύρωση','Cancel')}</Button><Button onClick={saveEdit} disabled={!canSave||saving||working}><Save size={15}/>{saving?tx('Αποθήκευση…','Saving…'):tx('Αποθήκευση','Save')}</Button></>:<Button variant=\"secondary\" onClick={()=>setEditing(true)}><Pencil size={15}/>{tx('Επεξεργασία','Edit')}</Button>}</div>\n        <fieldset className=\"platform-record-edit-fieldset\" disabled={!editing}><div className=\"platform-form-shell\">",'demo toolbar')
  s=mustReplace(s,"        </div>\n      </div>\n    </EntityRecordShell>","        </div></fieldset>\n      </div>\n    </EntityRecordShell>",'demo fieldset close')
  s=s.replace(/<label className="field"><span>\{tx\('Πόλη','City'\)\}<\/span><input value=\{draft\.city\} onChange=\{e=>setDraft\(x=>\(\{\.\.\.x,city:e\.target\.value\}\)\)\}\/><\/label><label className="field"><span>\{tx\('Χώρα','Country'\)\}<\/span><input value=\{draft\.country\} onChange=\{e=>setDraft\(x=>\(\{\.\.\.x,country:e\.target\.value\}\)\)\}\/><\/label>/,"<LocationAutocompleteField label={tx('Πόλη','City')} value={draft.city} onChange={value=>setDraft(x=>({...x,city:value}))} options={CITY_OPTIONS}/><LocationAutocompleteField label={tx('Χώρα','Country')} value={draft.country} onChange={value=>setDraft(x=>({...x,country:value}))} options={COUNTRY_OPTIONS}/>")
  s=s.replace('className="platform-demo-access-grid"><label className="field"><span>{tx(\'Υπεύθυνος επικοινωνίας\'', 'className="platform-demo-access-grid"><label className="field field-wide"><span>{tx(\'Υπεύθυνος επικοινωνίας\'')
  s=s.replace("</label><label className=\"field\"><span>{tx('Email πρόσκλησης','Invitation email')}","</label><label className=\"field field-wide\"><span>{tx('Email πρόσκλησης','Invitation email')}")
  fs.writeFileSync(path,s)
}

// Canonical layout support.
{
  const path='src/styles/design-system-layouts.css'
  let s=fs.readFileSync(path,'utf8')
  s+=`\n\n/* Canonical locked record details + edit affordance */\n.platform-record-edit-toolbar{display:flex;justify-content:flex-end;gap:8px;margin:0 0 10px}\n.platform-record-edit-toolbar .button{min-height:38px}\n.platform-record-edit-fieldset{min-width:0;margin:0;padding:0;border:0}\n.platform-record-edit-fieldset:disabled{opacity:1}\n.platform-record-edit-fieldset:disabled input,.platform-record-edit-fieldset:disabled select{background:var(--lo-color-surface-soft,#f6f8fb);color:var(--lo-color-text);cursor:default;opacity:1}\n.platform-demo-contact-grid{grid-template-columns:minmax(260px,1.35fr) minmax(300px,1.65fr) minmax(170px,.8fr) minmax(170px,.8fr)!important}\n.platform-demo-access-grid{grid-template-columns:minmax(260px,1.35fr) minmax(300px,1.65fr) minmax(170px,.8fr) minmax(170px,.8fr)!important}\n@media(max-width:1180px){.platform-demo-contact-grid,.platform-demo-access-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}}\n@media(max-width:760px){.platform-demo-contact-grid,.platform-demo-access-grid{grid-template-columns:1fr!important}.platform-record-edit-toolbar{justify-content:stretch}.platform-record-edit-toolbar .button{flex:1}}\n`
  fs.writeFileSync(path,s)
}
