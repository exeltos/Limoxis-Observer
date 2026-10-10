import { useState } from 'react'
import { GraduationCap,Lock } from 'lucide-react'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { supabase } from '../../core/supabase/client'
import { IDLE_LOCK_OPTIONS,announceIdleLockMinutes,useIdleLockMinutes } from '../../app/IdleLock'
import { useTenant } from '../../core/tenant/TenantContext'
import { hospitalScreenGuidesOn,screenGuideChoice,screenGuideValue } from '../demo/screenGuideSettings'

// Organization security settings. Screen lock after inactivity for shared
// ward computers and tablets: saved on change, and the open app picks the new
// value up at once.
export function SecurityPanel({tenant,isDemo=false}){
 const {language}=useLanguage()
 const el=language!=='en'
 const {notify}=useFeedback()
 const minutes=useIdleLockMinutes(tenant,isDemo)
 const [saving,setSaving]=useState(false)
 const {reloadMemberships}=useTenant()
 const [guides,setGuides]=useState(()=>screenGuideChoice(tenant?.screen_guides_enabled))
 async function changeGuides(next){
  setSaving(true)
  try{
   if(!isDemo){const {error}=await supabase.rpc('set_organization_screen_guides',{p_organization_id:tenant.id,p_enabled:screenGuideValue(next)});if(error)throw error}
   setGuides(next)
   if(!isDemo)await reloadMemberships?.()
   notify(el?'Η ρύθμιση των οδηγών οθονών αποθηκεύτηκε.':'Screen guides setting saved.','success')
  }catch(error){notify(error?.message||(el?'Αποτυχία αποθήκευσης.':'Save failed.'),'error')}
  finally{setSaving(false)}
 }
 async function change(next){
  setSaving(true)
  try{
   if(!isDemo){const {error}=await supabase.rpc('set_organization_idle_lock',{p_organization_id:tenant.id,p_minutes:next});if(error)throw error}
   announceIdleLockMinutes(next,{isDemo})
   notify(el?'Το κλείδωμα οθόνης αποθηκεύτηκε.':'Screen lock saved.','success')
  }catch(error){notify(error?.message||(el?'Αποτυχία αποθήκευσης.':'Save failed.'),'error')}
  finally{setSaving(false)}
 }
 return <section className="management-section">
  <div className="section-toolbar"><div><h2><Lock size={18}/> {el?'Ασφάλεια':'Security'}</h2><p>{el?'Ρυθμίσεις που ισχύουν για όλους τους χρήστες του νοσοκομείου.':'Settings that apply to every user of the hospital.'}</p></div></div>
  <div className="security-setting">
   <label className="field"><span>{el?'Κλείδωμα οθόνης μετά από αδράνεια':'Screen lock after inactivity'}</span>
    <select value={minutes} disabled={saving} onChange={event=>void change(Number(event.target.value))}>{IDLE_LOCK_OPTIONS.map(value=><option key={value} value={value}>{value?(el?`${value} λεπτά`:`${value} minutes`):(el?'Ποτέ':'Never')}</option>)}</select>
   </label>
   <small>{el?'Για κοινόχρηστους υπολογιστές και tablet των τμημάτων: όταν περάσει ο χρόνος χωρίς χρήση, η οθόνη κλειδώνει. Ξεκλειδώνει με τον κωδικό του ίδιου χρήστη, ή συνδέεται άλλος χρήστης. Ό,τι ήταν ανοιχτό παραμένει όπως ήταν.':'For shared ward computers and tablets: when the time passes without use, the screen locks. The same user unlocks it with their password, or another user signs in. Whatever was open stays as it was.'}</small>
  </div>
  <div className="security-setting">
   <label className="field"><span><GraduationCap size={14}/> {el?'Οδηγοί οθονών':'Screen guides'}</span>
    <select value={guides} disabled={saving||isDemo} onChange={event=>void changeGuides(event.target.value)}><option value="default">{hospitalScreenGuidesOn({is_demo:tenant?.is_demo})?(el?'Προεπιλογή (ενεργοί)':'Default (on)'):(el?'Προεπιλογή (ανενεργοί)':'Default (off)')}</option><option value="on">{el?'Ενεργοί για όλους':'On for everyone'}</option><option value="off">{el?'Ανενεργοί για όλους':'Off for everyone'}</option></select>
   </label>
   <small>{el?'Σύντομος οδηγός την πρώτη φορά που κάθε χρήστης ανοίγει μια οθόνη. Μπορείτε να τον αλλάξετε και ανά χρήστη, στους Χρήστες. Ο ίδιος ο χρήστης μπορεί να τον κλείσει από τον οδηγό.':'A short guide the first time each user opens a screen. You can also set it per user, under Users. Users can turn it off from the guide.'}</small>
  </div>
 </section>
}
