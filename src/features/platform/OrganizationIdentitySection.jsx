import { useEffect,useRef,useState } from 'react'
import { Building2,GraduationCap,ImagePlus,Lock,Save,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { supabase } from '../../core/supabase/client'
import { normalizeBranding,readLogoFile } from '../../core/organization/branding'
import { DEFAULT_IDLE_LOCK_MINUTES,IDLE_LOCK_OPTIONS } from '../../app/IdleLock'
import { screenGuideChoice,screenGuideValue } from '../demo/screenGuideSettings'
import './platformIdentity.css'

const settingsOf=organization=>({
 idleLockMinutes:organization?.idle_lock_minutes??DEFAULT_IDLE_LOCK_MINUTES,
 screenGuides:screenGuideChoice(organization?.screen_guides_enabled),
 ...normalizeBranding(organization?.branding),
})

// Platform Owner, organization record: the hospital's screen lock and identity
// (logo, report header), set up when onboarding it. The hospital admin can
// change the same settings later in Management → Access.
export function OrganizationIdentitySection({organization,language='el',onSaved}){
 const tx=(el,en)=>language==='en'?en:el
 const {notify}=useFeedback()
 const saved=settingsOf(organization)
 const [draft,setDraft]=useState(saved)
 const [saving,setSaving]=useState(false)
 const fileRef=useRef(null)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>setDraft(settingsOf(organization)),[organization?.id,organization?.idle_lock_minutes,organization?.branding,organization?.screen_guides_enabled])
 const dirty=draft.idleLockMinutes!==saved.idleLockMinutes||draft.screenGuides!==saved.screenGuides||draft.logo!==saved.logo||draft.reportHeader!==saved.reportHeader

 async function pick(event){
  const file=event.target.files?.[0]
  event.target.value=''
  if(!file)return
  try{const logo=await readLogoFile(file);setDraft(current=>({...current,logo}))}
  catch(error){notify(error?.message==='LOGO_SIZE'?tx('Το λογότυπο είναι πολύ μεγάλο (έως 300 KB).','The logo is too large (up to 300 KB).'):tx('Επιλέξτε εικόνα PNG, JPG, WebP ή SVG.','Choose a PNG, JPG, WebP or SVG image.'),'error')}
 }

 async function save(){
  setSaving(true)
  try{
   const branding={logo:draft.logo,reportHeader:draft.reportHeader.trim()}
   if(draft.idleLockMinutes!==saved.idleLockMinutes){const {error}=await supabase.rpc('set_organization_idle_lock',{p_organization_id:organization.id,p_minutes:draft.idleLockMinutes});if(error)throw error}
   if(draft.screenGuides!==saved.screenGuides){const {error}=await supabase.rpc('set_organization_screen_guides',{p_organization_id:organization.id,p_enabled:screenGuideValue(draft.screenGuides)});if(error)throw error}
   let storedBranding=organization?.branding
   if(draft.logo!==saved.logo||draft.reportHeader!==saved.reportHeader){const {data,error}=await supabase.rpc('set_organization_branding',{p_organization_id:organization.id,p_branding:branding});if(error)throw error;storedBranding=data||branding}
   onSaved?.({idle_lock_minutes:draft.idleLockMinutes,screen_guides_enabled:screenGuideValue(draft.screenGuides),branding:storedBranding})
   notify(tx('Οι ρυθμίσεις ασφάλειας & ταυτότητας αποθηκεύτηκαν.','Security & identity settings saved.'),'success')
  }catch(error){notify(error?.message||tx('Αποτυχία αποθήκευσης.','Save failed.'),'error')}
  finally{setSaving(false)}
 }

 return <section className="platform-form-section">
  <header><div><strong>{tx('Ασφάλεια & ταυτότητα','Security & identity')}</strong><span>{tx('Κλείδωμα οθόνης, λογότυπο και κεφαλίδα αναφορών του νοσοκομείου. Ο Διαχειριστής Νοσοκομείου μπορεί να τα αλλάξει από το Κέντρο Διαχείρισης.','Screen lock, logo and report header of the hospital. The Hospital Admin can change them in the Management Center.')}</span></div>
   {dirty&&<div className="platform-form-section-actions"><Button variant="secondary" onClick={()=>setDraft(saved)} disabled={saving}>{tx('Ακύρωση','Cancel')}</Button><Button onClick={()=>void save()} disabled={saving}><Save size={15}/>{saving?tx('Αποθήκευση…','Saving…'):tx('Αποθήκευση','Save')}</Button></div>}
  </header>
  <div className="platform-form-grid platform-identity-grid">
   <label className="field"><span><Lock size={13}/> {tx('Κλείδωμα οθόνης μετά από αδράνεια','Screen lock after inactivity')}</span><select value={draft.idleLockMinutes} onChange={e=>setDraft(current=>({...current,idleLockMinutes:Number(e.target.value)}))}>{IDLE_LOCK_OPTIONS.map(value=><option key={value} value={value}>{value?tx(`${value} λεπτά`,`${value} minutes`):tx('Ποτέ','Never')}</option>)}</select></label>
   <label className="field"><span><GraduationCap size={13}/> {tx('Οδηγοί οθονών','Screen guides')}</span><select value={draft.screenGuides} onChange={e=>setDraft(current=>({...current,screenGuides:e.target.value}))}><option value="default">{organization?.is_demo?tx('Προεπιλογή (ενεργοί, Demo)','Default (on, Demo)'):tx('Προεπιλογή (ανενεργοί)','Default (off)')}</option><option value="on">{tx('Ενεργοί για όλους','On for everyone')}</option><option value="off">{tx('Ανενεργοί για όλους','Off for everyone')}</option></select><small>{tx('Σύντομος οδηγός την πρώτη φορά που ο χρήστης ανοίγει κάθε οθόνη. Μπορεί να αλλάξει και ανά χρήστη.','A short guide the first time a user opens each screen. Can also be set per user.')}</small></label>
   <label className="field field-wide"><span>{tx('Γραμμή κεφαλίδας αναφορών','Report header line')}</span><input value={draft.reportHeader} maxLength={200} onChange={e=>setDraft(current=>({...current,reportHeader:e.target.value}))} placeholder={tx('π.χ. Επιτροπή Νοσοκομειακών Λοιμώξεων','e.g. Infection Control Committee')}/></label>
   <div className="field platform-identity-logo"><span>{tx('Λογότυπο','Logo')}</span>
    <div className="platform-identity-logo-row">
     <div className="platform-identity-logo-box">{draft.logo?<img src={draft.logo} alt=""/>:<Building2 size={22}/>}</div>
     <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={event=>void pick(event)}/>
     <Button variant="secondary" onClick={()=>fileRef.current?.click()}><ImagePlus size={15}/>{draft.logo?tx(' Αλλαγή',' Change'):tx(' Επιλογή εικόνας',' Choose image')}</Button>
     {draft.logo&&<Button variant="secondary" onClick={()=>setDraft(current=>({...current,logo:''}))}><Trash2 size={15}/>{tx(' Αφαίρεση',' Remove')}</Button>}
    </div>
   </div>
  </div>
 </section>
}
