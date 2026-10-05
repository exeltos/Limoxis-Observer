import { useEffect,useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ADDONS,ADDON_LABELS,OPERATING_PROFILES,PROFILE_LABELS,normalizeProfile } from '../../core/organization/operatingProfile'
import { setOrganizationOperatingProfile } from '../../core/tenant/tenantService'
import './operatingProfile.css'

// Platform Owner: which parts of the platform this organization uses.
export function OperatingProfileSection({organization,language='el',onSaved}){
  const en=language==='en',tx=(elText,enText)=>en?enText:elText
  const {notify,notifyError,confirm}=useFeedback()
  const current=normalizeProfile(organization)
  const [profile,setProfile]=useState(current.profile),[addons,setAddons]=useState(current.addons),[saving,setSaving]=useState(false)
  const currentKey=`${current.profile}|${current.addons.join(',')}`
  useEffect(()=>{setProfile(current.profile);setAddons(current.addons)},[currentKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const changed=profile!==current.profile||[...addons].sort().join(',')!==[...current.addons].sort().join(',')
  const rank={laboratory:0,surveillance:1,full:2}
  const narrowing=rank[profile]<rank[current.profile]||current.addons.some(item=>!addons.includes(item))
  function toggleAddon(id){setAddons(list=>list.includes(id)?list.filter(item=>item!==id):[...list,id])}
  async function save(){
    if(!changed||saving)return
    if(narrowing&&!await confirm({title:tx('Απενεργοποίηση ενοτήτων','Switch modules off'),message:tx('Οι ενότητες που κλείνουν και τα δεδομένα τους θα κρυφτούν από όλους τους χρήστες του οργανισμού. Δεν διαγράφεται τίποτα· αν ενεργοποιηθούν ξανά, επανέρχονται όπως ήταν.','The modules being switched off, and their data, will be hidden from every user of the organization. Nothing is deleted; switching them on again brings them back as they were.'),confirmLabel:tx('Αποθήκευση','Save')}))return
    setSaving(true)
    try{const saved=await setOrganizationOperatingProfile(organization.id,{profile,addons:ADDONS.filter(item=>addons.includes(item))});onSaved?.(saved);notify(tx('Το προφίλ λειτουργίας αποθηκεύτηκε.','Operating profile saved.'),'success')}
    catch(error){notifyError(error,'save',{operation:'platform_organization_operating_profile'})}
    finally{setSaving(false)}
  }
  return <section className="platform-form-section operating-profile-section">
    <header><div><strong>{tx('Προφίλ λειτουργίας','Operating profile')}</strong><span>{tx('Ποιες ενότητες χρησιμοποιεί το νοσοκομείο. Ό,τι είναι κλειστό δεν εμφανίζεται σε κανέναν χρήστη.','Which modules the hospital uses. Anything switched off is hidden from every user.')}</span></div><div className="platform-form-section-actions"><Button disabled={!changed||saving} loading={saving} onClick={save}><Save size={15}/>{tx('Αποθήκευση','Save')}</Button></div></header>
    <div className="operating-profile-options" role="radiogroup" aria-label={tx('Προφίλ λειτουργίας','Operating profile')}>
      {OPERATING_PROFILES.map(id=>{const label=PROFILE_LABELS[id];return <label key={id} className={`operating-profile-option${profile===id?' selected':''}`}><input type="radio" name={`operating-profile-${organization.id}`} value={id} checked={profile===id} onChange={()=>setProfile(id)}/><span><strong>{en?label.en:label.el}</strong><small>{en?label.hintEn:label.hintEl}</small></span></label>})}
    </div>
    <div className="operating-profile-addons"><span className="operating-profile-addons-title">{tx('Πρόσθετα','Add-ons')}</span>
      {ADDONS.map(id=><label key={id} className="operating-profile-addon"><input type="checkbox" checked={addons.includes(id)} onChange={()=>toggleAddon(id)}/><span>{en?ADDON_LABELS[id].en:ADDON_LABELS[id].el}</span></label>)}
    </div>
  </section>
}
