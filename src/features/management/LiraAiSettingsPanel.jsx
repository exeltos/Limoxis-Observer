import { useEffect,useState } from 'react'
import { KeyRound,Languages,Pencil,ShieldCheck,Unplug } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { OverflowMenu } from '../../design-system/OverflowMenu'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useTenant } from '../../core/tenant/TenantContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { supabase,invokeAuthenticatedFunction } from '../../core/supabase/client'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'

export function LiraAiSettingsPanel(){
 const {language}=useLanguage(),en=language==='en';const {tenant,isDemo}=useTenant();const {notify}=useFeedback()
 const [form,setForm]=useState({provider:'none',model:'gpt-5.6',apiKey:'',keyHint:'',allowAggregateData:true,allowPatientLevelData:false});const [loading,setLoading]=useState(true);const [tr,setTr]=useState({enabled:false,limit:200000,used:0,providerReady:false});const [busy,setBusy]=useState(false)
 // Read-only until «Edit» in the «⋯» menu; then «Cancel» and «Save» at the foot of the card bring it back (snapshot for cancel).
 const [editing,setEditing]=useState(null)
 useEffect(()=>{if(isDemo||!tenant?.id){setLoading(false);return}let active=true;supabase.rpc('get_lira_ai_provider_settings',{p_organization_id:tenant.id}).then(({data,error})=>{if(error)throw error;const row=data?.[0];if(active&&row)setForm(v=>({...v,provider:row.provider,model:row.model||'gpt-5.6',keyHint:row.key_hint||'',allowAggregateData:row.allow_aggregate_data,allowPatientLevelData:row.allow_patient_level_data}))}).catch(e=>active&&notify(e.message,'error')).finally(()=>active&&setLoading(false));return()=>{active=false}},[tenant?.id,isDemo,notify])
 useEffect(()=>{if(isDemo||!tenant?.id)return undefined;let active=true;supabase.rpc('get_translation_settings',{p_organization_id:tenant.id}).then(({data,error})=>{const row=data?.[0];if(active&&!error&&row)setTr({enabled:row.enabled,limit:row.monthly_char_limit,used:row.used_chars,providerReady:row.provider_ready})});return()=>{active=false}},[tenant?.id,isDemo])
 // One save for the page: the provider (through the edge function, which keeps the key in Vault) and the translation setting.
 async function save(){setBusy(true);try{await invokeAuthenticatedFunction('lira-provider-settings',{action:'save',organizationId:tenant.id,provider:form.provider,model:form.model,apiKey:form.apiKey,allowAggregateData:form.allowAggregateData,allowPatientLevelData:form.allowPatientLevelData});setForm(v=>({...v,apiKey:'',keyHint:v.apiKey?`••••${v.apiKey.slice(-4)}`:v.keyHint}));const {error}=await supabase.rpc('set_translation_settings',{p_organization_id:tenant.id,p_enabled:tr.enabled,p_monthly_char_limit:Number(tr.limit)||0});if(error)throw error;setEditing(null);notify(en?'LIRA AI settings saved.':'Οι ρυθμίσεις LIRA AI αποθηκεύτηκαν.','success')}catch(e){notify(e.message,'error')}finally{setBusy(false)}}
 async function disconnect(){setBusy(true);try{await invokeAuthenticatedFunction('lira-provider-settings',{action:'disconnect',organizationId:tenant.id});setForm(v=>({...v,provider:'none',apiKey:'',keyHint:''}));notify(en?'AI provider disconnected.':'Ο πάροχος AI αποσυνδέθηκε.','success')}catch(e){notify(e.message,'error')}finally{setBusy(false)}}
 if(loading)return <TableSkeleton/>
 const permissions=[
  {key:'allowAggregateData',title:en?'Aggregate, de-identified data':'Συγκεντρωτικά, ανώνυμα δεδομένα',text:en?'Counts, rates and trends without patient identifiers.':'Αριθμοί, δείκτες και τάσεις χωρίς στοιχεία ταυτότητας ασθενών.'},
  {key:'allowPatientLevelData',title:en?'Patient-level data':'Δεδομένα επιπέδου ασθενούς',text:en?'Only with the hospital’s data-protection approval.':'Μόνο με έγκριση προστασίας δεδομένων του νοσοκομείου.'},
 ]
 const off=isDemo||busy||!editing
 const startEdit=()=>setEditing({form,tr})
 const cancelEdit=()=>{setForm(editing.form);setTr(editing.tr);setEditing(null)}
 const menu=[{label:en?'Edit':'Επεξεργασία',icon:Pencil,onClick:startEdit,disabled:isDemo||Boolean(editing)},{label:en?'Disconnect':'Αποσύνδεση',icon:Unplug,tone:'danger',onClick:disconnect,disabled:isDemo||busy||!form.keyHint}]
 return <section className="management-section management-scroll-section management-lira-ai">
 <div className="lira-ai-head"><div><h2>LIRA & AI{isDemo&&<span className="status-badge temporary">{en?'Read-only in the demo':'Μόνο προβολή στο demo'}</span>}</h2><p>{en?'Connect an AI provider for this hospital. Without one, LIRA keeps working with its built-in rules.':'Συνδέστε πάροχο τεχνητής νοημοσύνης για αυτό το νοσοκομείο. Χωρίς πάροχο, η LIRA συνεχίζει να λειτουργεί με τους ενσωματωμένους κανόνες της.'}</p></div>
 <OverflowMenu items={menu} label={en?'LIRA & AI actions':'Ενέργειες LIRA & AI'}/></div>
 <div className="lira-ai-grid">
 <section className="lira-ai-block"><h3><KeyRound size={15} aria-hidden="true"/>{en?'Connection':'Σύνδεση'}{form.keyHint?<span className="status-badge active">{en?'Connected':'Συνδεδεμένο'} {form.keyHint}</span>:<span className="status-badge neutral">{en?'No provider':'Χωρίς πάροχο'}</span>}</h3>
 <div className="lira-ai-fields"><label className="field"><span>{en?'AI provider':'Πάροχος AI'}</span><select value={form.provider} disabled={off} onChange={e=>setForm(v=>({...v,provider:e.target.value}))}><option value="none">{en?'No AI provider':'Χωρίς πάροχο AI'}</option><option value="openai">OpenAI</option></select></label>
 <label className="field"><span>{en?'Model':'Μοντέλο'}</span><input value={form.provider==='none'?'':form.model} placeholder={form.provider==='none'?(en?'Choose a provider first':'Επιλέξτε πρώτα πάροχο'):'gpt-5.6'} disabled={off||form.provider==='none'} onChange={e=>setForm(v=>({...v,model:e.target.value}))}/></label>
 <label className="field lira-ai-wide"><span>{en?'Access key':'Κλειδί πρόσβασης'}</span><input type="password" autoComplete="new-password" value={form.apiKey} disabled={off||form.provider==='none'} placeholder={form.keyHint||''} onChange={e=>setForm(v=>({...v,apiKey:e.target.value}))}/><small>{en?'Stored encrypted on the server and never shown again.':'Αποθηκεύεται κρυπτογραφημένο στον διακομιστή και δεν εμφανίζεται ξανά.'}</small></label></div></section>
 <section className="lira-ai-block"><h3><ShieldCheck size={15} aria-hidden="true"/>{en?'Data LIRA may use':'Δεδομένα που χρησιμοποιεί η LIRA'}</h3>
 {permissions.map(item=><label key={item.key} className="lira-ai-check"><input type="checkbox" checked={form[item.key]} disabled={off} onChange={e=>setForm(v=>({...v,[item.key]:e.target.checked}))}/><span><strong>{item.title}</strong><small>{item.text}</small></span></label>)}</section>
 </div>
 {/* Automatic translation of the hospital's own texts (docs/TRANSLATION_DESIGN.md): off until the hospital turns it on, with a monthly limit of characters; it uses the provider connected above. */}
 <section className="lira-ai-block lira-ai-translation"><h3><Languages size={15} aria-hidden="true"/>{en?'Automatic translation':'Αυτόματη μετάφραση'}</h3>
 <div className="lira-ai-translation-row"><label className="lira-ai-check"><input type="checkbox" checked={tr.enabled} disabled={off} onChange={e=>setTr(v=>({...v,enabled:e.target.checked}))}/><span><strong>{en?'Translate my texts into English automatically':'Αγγλική εκδοχή των κειμένων μας αυτόματα'}</strong><small>{tr.providerReady||form.keyHint?(en?'Titles and descriptions only; names and clinical notes are never sent.':'Μόνο τίτλοι και περιγραφές· ονόματα και κλινικές σημειώσεις δεν στέλνονται ποτέ.'):(en?'Connect an AI provider first; until then nothing is translated.':'Συνδέστε πρώτα πάροχο AI· μέχρι τότε δεν μεταφράζεται τίποτα.')}</small></span></label>
 <label className="field"><span>{en?'Monthly limit (characters)':'Μηνιαίο όριο (χαρακτήρες)'}</span><input inputMode="numeric" value={tr.limit} disabled={off} onChange={e=>setTr(v=>({...v,limit:e.target.value.replace(/\D/g,'')}))}/><small>{en?`Used this month: ${tr.used.toLocaleString('en-GB')}`:`Χρήση αυτόν τον μήνα: ${tr.used.toLocaleString('el-GR')}`}</small></label></div></section>
 {editing&&<div className="lira-ai-foot"><Button variant="secondary" disabled={busy} onClick={cancelEdit}>{en?'Cancel':'Ακύρωση'}</Button><SaveButton loading={busy} onClick={save}>{en?'Save':'Αποθήκευση'}</SaveButton></div>}
 </section>
}
