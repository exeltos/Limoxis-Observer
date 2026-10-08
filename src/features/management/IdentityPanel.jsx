import { useEffect,useRef,useState } from 'react'
import { Building2,ImagePlus,Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { supabase } from '../../core/supabase/client'
import { announceBranding,readLogoFile,useOrganizationBranding } from '../../core/organization/branding'

// Hospital identity: the logo and report header line printed at the top of
// every PDF and on training certificates, and the logo in the top bar.
export function IdentityPanel({tenant,isDemo=false}){
 const {language}=useLanguage()
 const el=language!=='en'
 const {notify}=useFeedback()
 const saved=useOrganizationBranding(tenant,isDemo)
 const [draft,setDraft]=useState(saved)
 const [saving,setSaving]=useState(false)
 const fileRef=useRef(null)
 useEffect(()=>setDraft(saved),[saved])
 const dirty=draft.logo!==saved.logo||draft.reportHeader!==saved.reportHeader

 async function pick(event){
  const file=event.target.files?.[0]
  event.target.value=''
  if(!file)return
  try{const logo=await readLogoFile(file);setDraft(current=>({...current,logo}))}
  catch(error){notify(error?.message==='LOGO_TYPE'?(el?'Επιλέξτε εικόνα PNG, JPG, WebP ή SVG.':'Choose a PNG, JPG, WebP or SVG image.'):error?.message==='LOGO_SIZE'?(el?'Το λογότυπο είναι πολύ μεγάλο (έως 300 KB).':'The logo is too large (up to 300 KB).'):(el?'Δεν ήταν δυνατή η ανάγνωση της εικόνας.':'The image could not be read.'),'error')}
 }

 async function save(){
  setSaving(true)
  try{
   const value={logo:draft.logo,reportHeader:draft.reportHeader.trim()}
   if(!isDemo){const {error}=await supabase.rpc('set_organization_branding',{p_organization_id:tenant.id,p_branding:value});if(error)throw error}
   announceBranding(value,{isDemo})
   notify(el?'Η ταυτότητα του νοσοκομείου αποθηκεύτηκε.':'Hospital identity saved.','success')
  }catch(error){notify(error?.message||(el?'Αποτυχία αποθήκευσης.':'Save failed.'),'error')}
  finally{setSaving(false)}
 }

 return <section className="management-section">
  <div className="section-toolbar"><div><h2><Building2 size={18}/> {el?'Ταυτότητα νοσοκομείου':'Hospital identity'}</h2><p>{el?'Λογότυπο και γραμμή κεφαλίδας που τυπώνονται στην κορυφή κάθε PDF και στα πιστοποιητικά εκπαίδευσης.':'Logo and header line printed at the top of every PDF and on training certificates.'}</p></div></div>
  <div className="identity-settings">
   <div className="identity-logo">
    <span>{el?'Λογότυπο':'Logo'}</span>
    <div className="identity-logo-box">{draft.logo?<img src={draft.logo} alt=""/>:<Building2 size={28}/>}</div>
    <div className="identity-logo-actions">
     <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={event=>void pick(event)}/>
     <Button variant="secondary" onClick={()=>fileRef.current?.click()}><ImagePlus size={15}/>{draft.logo?(el?' Αλλαγή':' Change'):(el?' Επιλογή εικόνας':' Choose image')}</Button>
     {draft.logo&&<Button variant="secondary" onClick={()=>setDraft(current=>({...current,logo:''}))}><Trash2 size={15}/>{el?' Αφαίρεση':' Remove'}</Button>}
    </div>
    <small>{el?'PNG, JPG, WebP ή SVG. Μεγάλες εικόνες μικραίνουν αυτόματα.':'PNG, JPG, WebP or SVG. Large images are scaled down.'}</small>
   </div>
   <label className="field identity-header"><span>{el?'Γραμμή κεφαλίδας αναφορών':'Report header line'}</span><input value={draft.reportHeader} maxLength={200} onChange={event=>setDraft(current=>({...current,reportHeader:event.target.value}))} placeholder={el?'π.χ. Επιτροπή Νοσοκομειακών Λοιμώξεων · 2ª ΥΠΕ Πειραιώς & Αιγαίου':'e.g. Infection Control Committee · 2nd Health Region'}/></label>
   <div className="identity-preview">
    <span>{el?'Προεπισκόπηση κεφαλίδας PDF':'PDF header preview'}</span>
    <div className="identity-preview-band">{draft.logo&&<img src={draft.logo} alt=""/>}<div><strong>{tenant?.name||''}</strong>{draft.reportHeader&&<small>{draft.reportHeader}</small>}</div></div>
   </div>
  </div>
  <div className="inline-edit-footer">{dirty&&<Button variant="secondary" onClick={()=>setDraft(saved)} disabled={saving}>{el?'Ακύρωση':'Cancel'}</Button>}<SaveButton loading={saving} disabled={!dirty||saving} onClick={()=>void save()}>{el?'Αποθήκευση':'Save'}</SaveButton></div>
 </section>
}
