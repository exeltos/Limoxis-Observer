import { useEffect,useState } from 'react'
import { BarChart3,Check,Lock,Save } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ADDONS,ADDON_LABELS,MODULES,OPERATING_PROFILES,PROFILE_LABELS,normalizeProfile,profileModules } from '../../core/organization/operatingProfile'
import { setOrganizationOperatingProfile } from '../../core/tenant/tenantService'
import './operatingProfile.css'

// Platform Owner: which parts of the platform this organization uses.
// Three separate blocks: 1) base package (pick one), 2) add-ons (on/off), 3) summary of what the save changes.
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
  const label=item=>en?item.en:item.el
  const before=[...profileModules(current.profile),...current.addons],after=[...profileModules(profile),...addons]
  const names=id=>MODULES[id]?label(MODULES[id]):label(ADDON_LABELS[id])
  const switchedOff=before.filter(id=>!after.includes(id)),switchedOn=after.filter(id=>!before.includes(id))
  function toggleAddon(id){setAddons(list=>list.includes(id)?list.filter(item=>item!==id):[...list,id])}
  async function save(){
    if(!changed||saving)return
    if(narrowing&&!await confirm({title:tx('Απενεργοποίηση ενοτήτων','Switch modules off'),message:tx('Οι ενότητες που κλείνουν και τα δεδομένα τους θα κρυφτούν από όλους τους χρήστες του οργανισμού. Δεν διαγράφεται τίποτα· αν ενεργοποιηθούν ξανά, επανέρχονται όπως ήταν.','The modules being switched off, and their data, will be hidden from every user of the organization. Nothing is deleted; switching them on again brings them back as they were.'),confirmLabel:tx('Αποθήκευση','Save')}))return
    setSaving(true)
    try{const saved=await setOrganizationOperatingProfile(organization.id,{profile,addons:ADDONS.filter(item=>addons.includes(item))});onSaved?.(saved);notify(tx('Το προφίλ λειτουργίας αποθηκεύτηκε.','Operating profile saved.'),'success')}
    catch(error){notifyError(error,'save',{operation:'platform_organization_operating_profile'})}
    finally{setSaving(false)}
  }
  return <div className="operating-profile">
    <section className="platform-form-section operating-profile-block">
      <header><div><strong><span className="operating-profile-step">1</span>{tx('Βασικό πακέτο','Base package')}</strong><span>{tx('Επιλέξτε ένα επίπεδο. Κάθε επίπεδο περιλαμβάνει όλα τα προηγούμενα· ό,τι είναι κλειστό δεν εμφανίζεται σε κανέναν χρήστη.','Choose one level. Each level includes the previous ones; anything switched off is hidden from every user.')}</span></div></header>
      <div className="operating-profile-options" role="radiogroup" aria-label={tx('Βασικό πακέτο','Base package')}>
        {OPERATING_PROFILES.map(id=>{const text=PROFILE_LABELS[id],included=profileModules(id);return <label key={id} className={`operating-profile-option${profile===id?' selected':''}`}>
          <input type="radio" name={`operating-profile-${organization.id}`} value={id} checked={profile===id} onChange={()=>setProfile(id)}/>
          <span className="operating-profile-option-body"><strong>{en?text.en:text.el}{current.profile===id&&<em className="operating-profile-current">{tx('Ενεργό','Current')}</em>}</strong><small>{en?text.hintEn:text.hintEl}</small>
            <ul className="operating-profile-modules">{Object.keys(MODULES).map(key=>{const on=included.includes(key);return <li key={key} className={on?'on':'off'}>{on?<Check size={12} aria-hidden="true"/>:<Lock size={11} aria-hidden="true"/>}<span>{label(MODULES[key])}</span></li>})}</ul>
          </span></label>})}
      </div>
    </section>
    <section className="platform-form-section operating-profile-block">
      <header><div><strong><span className="operating-profile-step">2</span>{tx('Πρόσθετες ενότητες','Add-on modules')}</strong><span>{tx('Ανεξάρτητες από το πακέτο: ενεργοποιούνται ή κλείνουν μία-μία. Κάθε ενότητα έχει δική της ανάλυση και report στις Αναλύσεις.','Independent of the package: switched on or off one by one. Each module has its own analysis and report in Analysis.')}</span></div></header>
      <div className="operating-profile-addons">
        {ADDONS.map(id=><label key={id} className={`operating-profile-addon${addons.includes(id)?' selected':''}`}>
          <input type="checkbox" role="switch" checked={addons.includes(id)} onChange={()=>toggleAddon(id)}/>
          <span className="operating-profile-addon-body"><strong>{en?ADDON_LABELS[id].en:ADDON_LABELS[id].el}</strong><small>{en?ADDON_LABELS[id].hintEn:ADDON_LABELS[id].hintEl}</small><em className="operating-profile-report"><BarChart3 size={11} aria-hidden="true"/>{tx('Ανάλυση & report','Analysis & report')}</em></span>
        </label>)}
      </div>
    </section>
    <section className={`platform-form-section operating-profile-block operating-profile-summary${changed?' changed':''}`}>
      <header><div><strong><span className="operating-profile-step">3</span>{tx('Σύνοψη αλλαγών','Summary of changes')}</strong>
        <span>{!changed?tx('Καμία αλλαγή σε σχέση με το αποθηκευμένο προφίλ.','No change from the saved profile.'):<>{switchedOn.length>0&&<span className="operating-profile-change on">{tx('Ενεργοποιούνται: ','Switched on: ')}{switchedOn.map(names).join(', ')}</span>}{switchedOff.length>0&&<span className="operating-profile-change off">{tx('Κρύβονται: ','Hidden: ')}{switchedOff.map(names).join(', ')}</span>}</>}</span></div>
        <div className="platform-form-section-actions"><Button disabled={!changed||saving} loading={saving} onClick={save}><Save size={15}/>{tx('Αποθήκευση','Save')}</Button></div></header>
    </section>
  </div>
}
