import { useEffect,useMemo,useState } from 'react'
import { LockKeyhole,Pencil,Plus,ShieldCheck,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { EntityRecordShell } from '../../design-system/EntityRecordShell'
import { SaveButton } from '../../design-system/SaveButton'
import { RecordTabPanel } from '../../design-system/RecordTabPanel'
import { FilterBar,FilterSelect } from '../../design-system/FilterBar'
import { RegistryTable } from '../../design-system/RegistryTable'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { capabilityLabel } from '../../core/permissions/capabilityLabels'
import { capabilityCatalogue,isCustomRoleEligible } from '../../core/permissions/capabilityCatalogue'
import { roleCapabilities,roleCapabilityRule } from '../../core/permissions/systemRoleMatrix'
import { managementRoleNames } from './managementRoles'
import { createCustomRole,deactivateCustomRole,loadCustomRoles,updateCustomRole } from './managementCloudService'
import { signalDemoStep } from '../demo/demoScenarioSignals'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import type { Dispatch,SetStateAction } from 'react'
import type { CapabilityDefinition } from '../../core/permissions/types'

type Pair = string[]
// A role of the list: a custom role as loadCustomRoles returns it (and the Demo's own), or a system role (system).
type RoleRow = { id: string, name: string, description?: string | null, is_active?: boolean | null, system?: boolean, capabilities: string[] }
type RoleDraft = { mode: string, id: string|null, name: string, capabilities: string[] }
type Permission = CapabilityDefinition & { id: string }
const domainLabels: Record<string,Pair>={
 administration:['Διαχείριση','Administration'],platform:['Πλατφόρμα','Platform'],clinical:['Κλινική φροντίδα','Clinical'],laboratory:['Εργαστήριο','Laboratory'],quality:['Ποιότητα','Quality'],committees:['Επιτροπές','Committees'],documents:['Έγγραφα','Documents'],controls:['Έλεγχοι','Controls'],training:['Εκπαίδευση','Training'],workforce:['Προσωπικό','Workforce'],occupational_health:['Ιατρός Εργασίας','Occupational health'],general:['Γενικά','General'],kitchen:['Κουζίνα','Kitchen'],
}
const scopeLabels: Record<string,Pair>={self:['Μόνο ο ίδιος','Self'],department:['Τμήμα','Department'],organization:['Οργανισμός','Organization'],platform:['Πλατφόρμα','Platform']}
const actionLabels: Record<string,Pair>={view:['Προβολή','View'],finalize:['Οριστικοποίηση','Finalize'],review:['Ανασκόπηση','Review'],request:['Αίτημα','Request'],reassess:['Επανεκτίμηση','Reassess'],send:['Αποστολή','Send'],create:['Δημιουργία','Create'],edit:['Επεξεργασία','Edit'],delete:['Διαγραφή','Delete'],manage:['Διαχείριση','Manage'],record:['Καταχώριση','Record'],execute:['Εκτέλεση','Execute'],approve:['Έγκριση','Approve'],publish:['Δημοσίευση','Publish'],archive:['Αρχειοθέτηση','Archive'],close:['Κλείσιμο','Close'],reopen:['Επαναφορά','Reopen'],validate:['Επικύρωση','Validate'],communicate:['Επικοινωνία','Communicate'],classify:['Ταξινόμηση','Classify'],submit:['Υποβολή','Submit'],supersede:['Αντικατάσταση','Supersede'],attach:['Επισύναψη','Attach'],print:['Εκτύπωση','Print'],export:['Εξαγωγή','Export'],assign:['Ανάθεση','Assign'],complete:['Ολοκλήρωση','Complete'],report:['Αναφορά','Report'],void:['Ακύρωση','Void']}
const groupLabel=(value: string,en: boolean)=>domainLabels[value]?.[en?1:0]||value
const scopeLabel=(value: string,en: boolean)=>scopeLabels[value]?.[en?1:0]||value||'—'
const actionLabel=(item: Pick<CapabilityDefinition,'actionType'>|null|undefined,en: boolean)=>actionLabels[item?.actionType as string]?.[en?1:0]||(en?'Other':'Άλλο')
// The Demo's own custom roles (owner, 9/11/2026: every screen of the Demo has data), in the shape loadCustomRoles returns.
const demoCustomRoles=(en: boolean): RoleRow[]=>[
 {id:'custom-demo-kitchen',name:en?'Kitchen manager':'Υπεύθυνος/η κουζίνας',description:'',is_active:true,capabilities:['view_kitchen','record_kitchen','manage_kitchen','view_documents','report_incident']},
 {id:'custom-demo-training',name:en?'Training coordinator':'Συντονιστής/τρια εκπαίδευσης',description:'',is_active:true,capabilities:['view_training','manage_training','view_staff','view_documents','report_incident']},
]

export function ManagementRolesPanel(){
 const {language,t}=useLanguage();const en=language==='en';const {tenant,isDemo}=useTenant();const {notify,confirm}=useFeedback()
 const [customRoles,setCustomRoles]=useState<RoleRow[]>([]);const [roleQuery,setRoleQuery]=useState('');const [loading,setLoading]=useState(false);const [selected,setSelected]=useState<{id: string,system: boolean}|null>(null);const [editor,setEditor]=useState<RoleDraft|null>(null)
 const customPermissions=useMemo(()=>Object.values(capabilityCatalogue).filter(item=>item.customRoleClass!=='system_only'),[])
 const systemRoles=useMemo(()=>Object.entries(managementRoleNames).filter(([key])=>key!=='demo'&&key!=='platform_owner').map(([key,labelKey])=>({id:key,name:t(labelKey),system:true,capabilities:roleCapabilities[key]||[]})),[t])
 useEffect(()=>{if(isDemo){setCustomRoles(demoCustomRoles(en).filter(role=>role.capabilities.every(isCustomRoleEligible)));return}if(!tenant?.id)return;let active=true;setLoading(true);loadCustomRoles(tenant.id).then(rows=>active&&setCustomRoles(rows)).catch(error=>active&&notify(error?.message||(en?'Failed to load roles.':'Αποτυχία φόρτωσης ρόλων.'),'error')).finally(()=>active&&setLoading(false));return()=>{active=false}},[isDemo,tenant?.id,notify,en])
 const selectedRole=useMemo(()=>selected?.system?systemRoles.find(x=>x.id===selected.id)||null:customRoles.find(x=>x.id===selected?.id)||null,[selected,systemRoles,customRoles])
 function openNew(){setSelected(null);setEditor({mode:'new',id:null,name:'',capabilities:[]})}
 function openEdit(role: RoleRow){if(role?.system)return;setEditor({mode:'edit',id:role.id,name:role.name||'',capabilities:[...(role.capabilities||[])]})}
 function closeEditor(){setEditor(null)}
 async function save(){if(!editor?.name.trim()||!editor.capabilities.length)return;try{const payload={name:editor.name.trim(),capabilities:editor.capabilities.filter(isCustomRoleEligible)};const saved=(isDemo?{id:editor.id||`custom-${Date.now()}`,...payload}:editor.mode==='edit'?await updateCustomRole(tenant!.id,editor.id as string,payload):await createCustomRole(tenant!.id,payload)) as RoleRow;setCustomRoles(rows=>editor.mode==='edit'?rows.map(r=>r.id===saved.id?saved:r):[...rows,saved]);setSelected({id:saved.id,system:false});setEditor(null);signalDemoStep('custom_roles','save');notify(en?'Role saved.':'Ο ρόλος αποθηκεύτηκε.','success')}catch(error){notify((error as Error)?.message||(en?'Save failed.':'Αποτυχία αποθήκευσης.'),'error')}}
 async function remove(role: RoleRow|null|undefined){if(!role||role.system)return;const ok=await confirm({title:en?'Delete role':'Διαγραφή ρόλου',message:en?`Delete “${role.name}”?`:`Να διαγραφεί ο ρόλος «${role.name}»;`,confirmLabel:en?'Delete':'Διαγραφή',danger:true});if(!ok)return;try{if(!isDemo)await deactivateCustomRole(tenant!.id,role.id);setCustomRoles(rows=>rows.filter(r=>r.id!==role.id));setSelected(null);notify(en?'Role deleted.':'Ο ρόλος διαγράφηκε.','success')}catch(error){notify((error as Error)?.message||(en?'Delete failed.':'Αποτυχία διαγραφής.'),'error')}}

 if(editor)return <RoleEditor en={en} value={editor} permissions={customPermissions} onChange={setEditor} onClose={closeEditor} onSave={save}/>

 if(selectedRole)return <EntityRecordShell className="management-user-shell" avatar={<ShieldCheck size={19}/>} eyebrow={selectedRole.system?(en?'System role':'Ρόλος συστήματος'):(en?'Custom role':'Προσαρμοσμένος ρόλος')} title={selectedRole.name} subtitle={`${(selectedRole.capabilities||[]).length} ${en?'permissions':'δικαιώματα'}`}
  headerActions={!selectedRole.system&&<div className="row-actions"><Button recordMenu variant="secondary" onClick={()=>openEdit(selectedRole)}><Pencil size={15}/>{en?'Edit role':'Επεξεργασία ρόλου'}</Button><Button recordMenu variant="secondary" onClick={()=>remove(selectedRole)}><Trash2 size={15}/>{en?'Delete role':'Διαγραφή ρόλου'}</Button></div>} onBack={()=>setSelected(null)}>
  <RecordTabPanel title={en?'What the role can do':'Τι μπορεί να κάνει ο ρόλος'} subtitle={selectedRole.system?(en?'Defined centrally · view only':'Ορίζεται κεντρικά · μόνο προβολή'):(en?'One line per area, with the actions allowed.':'Μία γραμμή ανά ενότητα, με τις ενέργειες που επιτρέπονται.')}>
   <RolePermissionSummary role={selectedRole} en={en}/>
  </RecordTabPanel>
 </EntityRecordShell>
 return <section className="management-section management-scroll-section"><div className="management-roles-panel workspace-fill"><FilterBar query={roleQuery} onQueryChange={setRoleQuery} placeholder={en?'Search role or area…':'Αναζήτηση ρόλου ή ενότητας…'} end={<Button onClick={openNew}><Plus size={15}/>{en?'New role':'Νέος ρόλος'}</Button>}/>{loading&&<TableSkeleton/>}<div className="scroll-table management-roles-list"><RegistryTable bare sortable={false} rows={[...systemRoles.map(role=>({...role,system:true,count:role.capabilities.length})),...customRoles.map(role=>({...role,system:false,count:(role.capabilities||[]).length}))].filter(role=>!roleQuery.trim()||`${role.name} ${roleAreas(role.capabilities,en)}`.toLocaleLowerCase('el').includes(roleQuery.trim().toLocaleLowerCase('el')))} rowKey={role=>`${role.system?'s':'c'}-${role.id}`}
  columns={[{key:'name',label:en?'Role':'Ρόλος'},{key:'does',label:en?'What it does':'Τι κάνει'},{key:'count',label:en?'Permissions':'Δικαιώματα'},...(customRoles.length?[{key:'kind',label:en?'Kind':'Είδος'}]:[])]}
  rowProps={role=>({className:'registry-row-clickable',tabIndex:0,onClick:()=>setSelected({id:role.id,system:role.system}),onKeyDown:event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected({id:role.id,system:role.system})}}})}
  renderRow={role=><><td><strong>{role.name}</strong></td><td className="management-role-does">{roleAreas(role.capabilities,en)}</td><td>{role.count}</td>{customRoles.length>0&&<td><span className={`status-badge ${role.system?'':'active'}`}>{role.system?(en?'System':'Συστήματος'):(en?'Custom':'Προσαρμοσμένος')}</span></td>}</>}/></div></div></section>
}

// «Τι κάνει» (owner, 8/11/2026): the areas a role works in, the ones with the most permissions first, at most three.
function roleAreas(capabilities: string[]=[],en: boolean){
 const counts=new Map<string,number>()
 for(const id of capabilities||[]){const domain=capabilityCatalogue[id]?.domain||'general';if(domain!=='general')counts.set(domain,(counts.get(domain)||0)+1)}
 const areas=[...counts].sort((a,b)=>b[1]-a[1]).map(([domain])=>groupLabel(domain,en))
 return areas.length?`${areas.slice(0,3).join(' · ')}${areas.length>3?` ${en?`+${areas.length-3} more`:`+${areas.length-3} ακόμα`}`:''}`:'—'
}

const ACTION_ORDER=['view','record','create','edit','execute','approve','publish','delete','archive','manage']
const actionOrder=(action: string)=>{const at=ACTION_ORDER.indexOf(action);return at<0?ACTION_ORDER.length:at}
// A role read per area: the actions it may take there, and only what is unusual (a narrower scope, sensitive data).
function RolePermissionSummary({role,en}: {role: RoleRow,en: boolean}){
 const rows=useMemo(()=>{const byDomain=new Map<string,{domain: string,actions: Set<string>,scopes: Set<string>,sensitive: boolean,items: string[]}>();for(const id of role.capabilities||[]){const def: Partial<CapabilityDefinition>=capabilityCatalogue[id]||{};const rule=role.system?roleCapabilityRule(role.id,id):null;const domain=def.domain||'general';const entry=byDomain.get(domain)||{domain,actions:new Set(),scopes:new Set(),sensitive:false,items:[]};entry.actions.add(def.actionType||'other');const scope=rule?.defaultScope||def.defaultScope||'organization';if(scope!=='organization')entry.scopes.add(scope);if(def.sensitivity&&def.sensitivity!=='standard')entry.sensitive=true;entry.items.push(capabilityLabel(id,en?'en':'el'));byDomain.set(domain,entry)}return [...byDomain.values()].sort((a,b)=>groupLabel(a.domain,en).localeCompare(groupLabel(b.domain,en),'el'))},[role,en])
 return <div className="management-user-body"><RegistryTable bare sortable={false} rows={rows} rowKey={row=>row.domain}
  columns={[{key:'area',label:en?'Area':'Ενότητα'},{key:'actions',label:en?'Allowed':'Επιτρέπεται'},{key:'notes',label:en?'Notes':'Σημειώσεις'}]}
  empty={!rows.length} emptyTitle={en?'No permissions.':'Δεν υπάρχουν δικαιώματα.'}
  renderRow={row=><><td><strong>{groupLabel(row.domain,en)}</strong><small title={row.items.join(' · ')}>{row.items.length} {row.items.length===1?(en?'permission':'δικαίωμα'):(en?'permissions':'δικαιώματα')}</small></td>
   <td>{[...new Set([...row.actions].sort((a,b)=>actionOrder(a)-actionOrder(b)).map(action=>actionLabels[action]?.[en?1:0]||(en?'Other':'Άλλο')))].join(' · ')}</td>
   <td>{[...[...row.scopes].map(scope=>`${en?'Scope':'Εύρος'}: ${scopeLabel(scope,en)}`),...(row.sensitive?[en?'Sensitive data':'Ευαίσθητα δεδομένα']:[])].join(' · ')||'—'}</td></>}/></div>
}

// New / edit a custom role: the name, then the permissions per area with one checkbox each; Save at the bottom.
function RoleEditor({en,value,permissions,onChange,onClose,onSave}: {en: boolean,value: RoleDraft,permissions: Permission[],onChange: Dispatch<SetStateAction<RoleDraft|null>>,onClose: ()=>void,onSave: ()=>void}){
 const [query,setQuery]=useState('');const [mode,setMode]=useState('all')
 const selected=useMemo(()=>new Set(value.capabilities||[]),[value.capabilities])
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return permissions.filter(item=>{if(mode==='selected'&&!selected.has(item.id))return false;const text=`${capabilityLabel(item.id,en?'en':'el')} ${groupLabel(item.domain,en)} ${actionLabel(item,en)}`.toLowerCase();return !q||text.includes(q)})},[permissions,query,mode,en,selected])
 const grouped=useMemo(()=>filtered.reduce((acc: Record<string,Permission[]>,item)=>{(acc[item.domain]??=[]).push(item);return acc},{}),[filtered])
 const toggle=(id: string)=>{if(!isCustomRoleEligible(id))return;onChange(v=>({...v!,capabilities:selected.has(id)?v!.capabilities.filter(x=>x!==id):[...v!.capabilities,id]}))}
 const title=value.mode==='edit'?(en?'Edit role':'Επεξεργασία ρόλου'):(en?'New role':'Νέος ρόλος')
 return <EntityRecordShell className="management-user-shell" avatar={<ShieldCheck size={19}/>} title={title} subtitle={en?'Define exactly what this role can do.':'Ορίστε ακριβώς τι μπορεί να κάνει ο ρόλος.'} onBack={onClose}>
  <RecordTabPanel title={en?'Role':'Ρόλος'} footer={<div className="inline-edit-footer"><span className="management-role-editor-count-text">{selected.size} {en?'selected':'επιλεγμένα'}</span><Button variant="secondary" onClick={onClose}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton onClick={onSave} disabled={!value.name.trim()||!value.capabilities.length}>{en?'Save':'Αποθήκευση'}</SaveButton></div>}>
   <div className="management-user-body">
    <label className="field"><span>{en?'Role name':'Όνομα ρόλου'}</span><input value={value.name} placeholder={en?'e.g. Clinic infection link':'π.χ. Σύνδεσμος Λοιμώξεων Κλινικής'} onChange={e=>onChange(v=>({...v!,name:e.target.value}))}/></label>
    <FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search by permission, area or action…':'Αναζήτηση με δικαίωμα, ενότητα ή ενέργεια…'} activeAdvancedCount={mode==='selected'?1:0} onClear={()=>{setQuery('');setMode('all')}}>
     <FilterSelect label={en?'Show':'Εμφάνιση'} value={mode} onChange={setMode}><option value="all">{en?'All':'Όλα'}</option><option value="selected">{en?'Only selected':'Μόνο επιλεγμένα'}</option></FilterSelect>
    </FilterBar>
    <div className="management-role-capability-groups">{Object.entries(grouped).map(([domain,items])=><section key={domain} className="management-role-capability-group"><header><strong>{groupLabel(domain,en)}</strong><span>{items.filter(item=>selected.has(item.id)).length}/{items.length}</span></header><div className="management-role-capability-list">{items.map(item=>{const selectable=isCustomRoleEligible(item.id);return <label key={item.id} className={`management-role-capability ${selected.has(item.id)?'selected':''} ${!selectable?'restricted':''}`} title={!selectable?(en?'Reserved for governed system roles':'Διατίθεται μόνο μέσω ελεγχόμενων ρόλων συστήματος'):''}><input type="checkbox" checked={selected.has(item.id)} disabled={!selectable} onChange={()=>toggle(item.id)}/><span className="management-role-capability-copy"><strong>{capabilityLabel(item.id,en?'en':'el')}</strong></span>{!selectable&&<span className="management-role-restricted"><LockKeyhole size={12}/>{en?'System':'Συστήματος'}</span>}</label>})}</div></section>)}{!Object.keys(grouped).length&&<div className="inline-empty management-role-no-results">{en?'No permissions match this search.':'Δεν βρέθηκαν δικαιώματα με αυτά τα κριτήρια.'}</div>}</div>
   </div>
  </RecordTabPanel>
 </EntityRecordShell>
}
