import { useEffect,useState } from 'react'
import { BarChart3,Check,Lock,Save } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ADDONS,ADDON_LABELS,CORE_MODULES,CUSTOM_PROFILE,MODULES,OPERATING_PROFILES,OPTIONAL_MODULES,PROFILE_LABELS,normalizeProfile,profileFor,profileModules } from '../../core/organization/operatingProfile'
import { setOrganizationOperatingProfile } from '../../core/tenant/tenantService'
import './operatingProfile.css'

// Platform Owner: which parts of the platform this organization uses.
// 1) a ready-made package fills the list, 2) every module can then be switched
// on or off one by one, 3) a summary of what saving changes.
export function OperatingProfileSection({organization,language='el',onSaved}){
  const en=language==='en',tx=(elText,enText)=>en?enText:elText
  const {notify,notifyError,confirm}=useFeedback()
  const current=normalizeProfile(organization)
  const [modules,setModules]=useState(current.modules),[addons,setAddons]=useState(current.addons),[saving,setSaving]=useState(false)
  const currentKey=`${current.modules.join(',')}|${current.addons.join(',')}`
  useEffect(()=>{setModules(current.modules);setAddons(current.addons)},[currentKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const sameSet=(a,b)=>[...a].sort().join(',')===[...b].sort().join(',')
  const changed=!sameSet(modules,current.modules)||!sameSet(addons,current.addons)
  const profile=profileFor(modules)
  const label=item=>en?item.en:item.el
  const before=[...current.modules,...current.addons],after=[...modules,...addons]
  const names=id=>MODULES[id]?label(MODULES[id]):label(ADDON_LABELS[id])
  const switchedOff=before.filter(id=>!after.includes(id)),switchedOn=after.filter(id=>!before.includes(id))
  const toggle=(setList,id)=>setList(list=>list.includes(id)?list.filter(item=>item!==id):[...list,id])
  async function save(){
    if(!changed||saving)return
    if(switchedOff.length&&!await confirm({title:tx('Απενεργοποίηση ενοτήτων','Switch modules off'),message:tx('Οι ενότητες που κλείνουν και τα δεδομένα τους θα κρυφτούν από όλους τους χρήστες του οργανισμού. Δεν διαγράφεται τίποτα· αν ενεργοποιηθούν ξανά, επανέρχονται όπως ήταν.','The modules being switched off, and their data, will be hidden from every user of the organization. Nothing is deleted; switching them on again brings them back as they were.'),confirmLabel:tx('Αποθήκευση','Save')}))return
    setSaving(true)
    try{const saved=await setOrganizationOperatingProfile(organization.id,{profile,addons:ADDONS.filter(item=>addons.includes(item)),modules:Object.keys(MODULES).filter(item=>modules.includes(item))});onSaved?.(saved);notify(tx('Το προφίλ λειτουργίας αποθηκεύτηκε.','Operating profile saved.'),'success')}
    catch(error){notifyError(error,'save',{operation:'platform_organization_operating_profile'})}
    finally{setSaving(false)}
  }
  const report=<em className="operating-profile-report"><BarChart3 size={11} aria-hidden="true"/>{tx('Ανάλυση & report','Analysis & report')}</em>
  return <div className="operating-profile">
    <section className="platform-form-section operating-profile-block">
      <header><div><strong><span className="operating-profile-step">1</span>{tx('Έτοιμο πακέτο','Ready-made package')}{profile===CUSTOM_PROFILE&&<em className="operating-profile-current">{tx('Προσαρμοσμένο','Custom')}</em>}</strong><span>{tx('Συντόμευση: η επιλογή γεμίζει τη λίστα ενοτήτων του βήματος 2, που μπορείτε μετά να αλλάξετε ελεύθερα μία-μία.','A shortcut: choosing one fills the module list of step 2, which you can then change freely one by one.')}</span></div></header>
      <div className="operating-profile-options" role="radiogroup" aria-label={tx('Έτοιμο πακέτο','Ready-made package')}>
        {OPERATING_PROFILES.map(id=>{const text=PROFILE_LABELS[id],included=profileModules(id);return <label key={id} className={`operating-profile-option${profile===id?' selected':''}`}>
          <input type="radio" name={`operating-profile-${organization.id}`} value={id} checked={profile===id} onChange={()=>setModules(included)}/>
          <span className="operating-profile-option-body"><strong>{en?text.en:text.el}{current.profile===id&&<em className="operating-profile-current">{tx('Ενεργό','Current')}</em>}</strong><small>{en?text.hintEn:text.hintEl}</small>
            <ul className="operating-profile-modules">{Object.keys(MODULES).map(key=>{const on=included.includes(key);return <li key={key} className={on?'on':'off'}>{on?<Check size={12} aria-hidden="true"/>:<Lock size={11} aria-hidden="true"/>}<span>{label(MODULES[key])}</span></li>})}</ul>
          </span></label>})}
      </div>
    </section>
    <section className="platform-form-section operating-profile-block">
      <header><div><strong><span className="operating-profile-step">2</span>{tx('Ενότητες του νοσοκομείου','Hospital modules')}</strong><span>{tx('Ορίστε ελεύθερα τι βλέπει το νοσοκομείο: κάθε ενότητα ανοίγει ή κλείνει ανεξάρτητα. Ό,τι κλείνει κρύβεται από όλους τους χρήστες, χωρίς να διαγράφονται δεδομένα. Κάθε ενότητα έχει δική της ανάλυση και report.','Decide freely what the hospital sees: each module is switched on or off independently. Anything switched off is hidden from every user; no data is deleted. Each module has its own analysis and report.')}</span></div></header>
      <p className="operating-profile-group-title">{tx('Πάντα ενεργά','Always on')}</p>
      <div className="operating-profile-core">{CORE_MODULES.map(id=><span key={id} className="operating-profile-core-item"><Check size={12} aria-hidden="true"/>{label(MODULES[id])}</span>)}</div>
      <p className="operating-profile-group-title">{tx('Ενότητες προγράμματος','Programme modules')}</p>
      <div className="operating-profile-addons">
        {OPTIONAL_MODULES.map(id=><label key={id} className={`operating-profile-addon${modules.includes(id)?' selected':''}`}>
          <input type="checkbox" role="switch" checked={modules.includes(id)} onChange={()=>toggle(setModules,id)}/>
          <span className="operating-profile-addon-body"><strong>{label(MODULES[id])}</strong>{MODULES[id].analysis&&report}</span>
        </label>)}
      </div>
      <p className="operating-profile-group-title">{tx('Πρόσθετα','Add-ons')}</p>
      <div className="operating-profile-addons">
        {ADDONS.map(id=><label key={id} className={`operating-profile-addon${addons.includes(id)?' selected':''}`}>
          <input type="checkbox" role="switch" checked={addons.includes(id)} onChange={()=>toggle(setAddons,id)}/>
          <span className="operating-profile-addon-body"><strong>{label(ADDON_LABELS[id])}</strong><small>{en?ADDON_LABELS[id].hintEn:ADDON_LABELS[id].hintEl}</small>{report}</span>
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
