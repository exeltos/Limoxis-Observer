import { useEffect,useState } from 'react'
import { BarChart3,Check,Lock,LockOpen,Save,TriangleAlert } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { ADDONS,ADDON_LABELS,CORE_MODULES,MODULES,OPERATING_PROFILES,OPTIONAL_MODULES,PROFILE_LABELS,missingDependencies,normalizeProfile,profileFor,profileModules } from '../../core/organization/operatingProfile'
import { setOrganizationOperatingProfile } from '../../core/tenant/tenantService'
import './operatingProfile.css'

// The largest preset fully contained in a module list: the package a saved profile is shown under.
const basePackage=modules=>[...OPERATING_PROFILES].reverse().find(id=>profileModules(id).every(key=>modules.includes(key)))||OPERATING_PROFILES[0]

// Platform Owner: which parts of the platform this organization uses.
// Pick a package, then click the lock of any module to unlock (or lock) it for this hospital.
export function OperatingProfileSection({organization,language='el',onSaved}){
  const en=language==='en',tx=(elText,enText)=>en?enText:elText
  const {notify,notifyError,confirm}=useFeedback()
  const current=normalizeProfile(organization)
  const [base,setBase]=useState(()=>basePackage(current.modules)),[modules,setModules]=useState(current.modules),[addons,setAddons]=useState(current.addons),[saving,setSaving]=useState(false)
  const currentKey=`${current.modules.join(',')}|${current.addons.join(',')}`
  useEffect(()=>{setBase(basePackage(current.modules));setModules(current.modules);setAddons(current.addons)},[currentKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const sameSet=(a,b)=>[...a].sort().join(',')===[...b].sort().join(',')
  const changed=!sameSet(modules,current.modules)||!sameSet(addons,current.addons)
  const profile=profileFor(modules)
  const label=item=>en?item.en:item.el
  const before=[...current.modules,...current.addons],after=[...modules,...addons]
  const missing=missingDependencies(modules),missingByModule=Object.fromEntries(missing)
  const needs=id=>(missingByModule[id]||[]).map(key=>label(MODULES[key])).join(', ')
  const names=id=>MODULES[id]?label(MODULES[id]):label(ADDON_LABELS[id])
  const switchedOff=before.filter(id=>!after.includes(id)),switchedOn=after.filter(id=>!before.includes(id))
  const toggle=(setList,id)=>setList(list=>list.includes(id)?list.filter(item=>item!==id):[...list,id])
  function choose(id){if(id===base)return;setBase(id);setModules(profileModules(id))}
  async function save(){
    if(!changed||saving)return
    if(switchedOff.length&&!await confirm({title:tx('Απενεργοποίηση ενοτήτων','Switch modules off'),message:tx('Οι ενότητες που κλείνουν και τα δεδομένα τους θα κρυφτούν από όλους τους χρήστες του οργανισμού. Δεν διαγράφεται τίποτα· αν ενεργοποιηθούν ξανά, επανέρχονται όπως ήταν.','The modules being switched off, and their data, will be hidden from every user of the organization. Nothing is deleted; switching them on again brings them back as they were.'),confirmLabel:tx('Αποθήκευση','Save')}))return
    setSaving(true)
    try{const saved=await setOrganizationOperatingProfile(organization.id,{profile,addons:ADDONS.filter(item=>addons.includes(item)),modules:Object.keys(MODULES).filter(item=>modules.includes(item))});onSaved?.(saved);notify(tx('Το προφίλ λειτουργίας αποθηκεύτηκε.','Operating profile saved.'),'success')}
    catch(error){notifyError(error,'save',{operation:'platform_organization_operating_profile'})}
    finally{setSaving(false)}
  }
  // One row per module: in the chosen package it is a button — the lock opens or closes the module.
  const row=({id,text,on,open,fixed,editable,analysis,warning,onToggle})=>{
    const icon=fixed||on?(open?<LockOpen size={12} aria-hidden="true"/>:<Check size={12} aria-hidden="true"/>):<Lock size={11} aria-hidden="true"/>
    const body=<><span className="operating-profile-row-icon">{icon}</span><span className="operating-profile-row-text">{text}</span>{analysis&&<BarChart3 size={11} className="operating-profile-row-report" aria-label={tx('Έχει ανάλυση & report','Has analysis & report')}/>}</>
    return <li key={id} className={`${on?'on':'off'}${open?' unlocked':''}`}>{editable&&!fixed?<button type="button" role="switch" aria-checked={on} title={on?tx('Πατήστε για κλείδωμα','Click to lock'):tx('Πατήστε για ξεκλείδωμα','Click to unlock')} onClick={onToggle}>{body}</button>:<span className="operating-profile-row-static">{body}</span>}{warning&&<span className="operating-profile-row-warning"><TriangleAlert size={11} aria-hidden="true"/>{tx('Χρειάζεται και: ','Also needs: ')}{warning}</span>}</li>
  }
  return <div className="operating-profile">
    <section className="platform-form-section operating-profile-block">
      <header><div><strong><span className="operating-profile-step">1</span>{tx('Πακέτο και ενότητες','Package and modules')}{profile==='custom'&&<em className="operating-profile-custom">{tx('Προσαρμοσμένο','Custom')}</em>}</strong><span>{tx('Επιλέξτε πακέτο. Μετά, στο επιλεγμένο πακέτο, πατήστε στο κλειδί μιας ενότητας για να την ξεκλειδώσετε ή να την κλειδώσετε για αυτό το νοσοκομείο. Ό,τι είναι κλειδωμένο κρύβεται από όλους τους χρήστες, χωρίς να διαγράφονται δεδομένα. Κάθε ενότητα έχει δική της ανάλυση και report.','Choose a package. Then, in the chosen package, click the lock of a module to unlock or lock it for this hospital. Anything locked is hidden from every user; no data is deleted. Each module has its own analysis and report.')}</span></div></header>
      <div className="operating-profile-options" role="radiogroup" aria-label={tx('Πακέτο','Package')}>
        {OPERATING_PROFILES.map(id=>{const text=PROFILE_LABELS[id],selected=base===id,preset=profileModules(id),custom=selected&&!sameSet(modules,preset)
          return <div key={id} className={`operating-profile-option${selected?' selected':''}`} onClick={()=>choose(id)}>
            <label className="operating-profile-option-head"><input type="radio" name={`operating-profile-${organization.id}`} value={id} checked={selected} onChange={()=>choose(id)}/><span><strong>{en?text.en:text.el}{current.profile===id&&<em className="operating-profile-current">{tx('Ενεργό','Current')}</em>}{custom&&<em className="operating-profile-custom">{tx('Προσαρμοσμένο','Custom')}</em>}</strong><small>{en?text.hintEn:text.hintEl}</small></span></label>
            <ul className="operating-profile-modules">
              {CORE_MODULES.map(key=>row({id:key,text:label(MODULES[key]),on:true,fixed:true}))}
              {OPTIONAL_MODULES.map(key=>{const included=selected?modules.includes(key):preset.includes(key);return row({id:key,text:label(MODULES[key]),on:included,open:selected&&included&&!preset.includes(key),editable:selected,analysis:MODULES[key].analysis,warning:selected&&included?needs(key):'',onToggle:()=>toggle(setModules,key)})})}
            </ul>
            <p className="operating-profile-group-title">{tx('Πρόσθετα','Add-ons')}</p>
            <ul className="operating-profile-modules">
              {ADDONS.map(key=>row({id:key,text:label(ADDON_LABELS[key]),on:addons.includes(key),open:selected&&addons.includes(key)&&!current.addons.includes(key),editable:selected,analysis:true,onToggle:()=>toggle(setAddons,key)}))}
            </ul>
          </div>})}
      </div>
    </section>
    <section className={`platform-form-section operating-profile-block operating-profile-summary${changed?' changed':''}`}>
      <header><div><strong><span className="operating-profile-step">2</span>{tx('Σύνοψη αλλαγών','Summary of changes')}</strong>
        <span>{!changed?tx('Καμία αλλαγή σε σχέση με το αποθηκευμένο προφίλ.','No change from the saved profile.'):<>{switchedOn.length>0&&<span className="operating-profile-change on">{tx('Ενεργοποιούνται: ','Switched on: ')}{switchedOn.map(names).join(', ')}</span>}{switchedOff.length>0&&<span className="operating-profile-change off">{tx('Κρύβονται: ','Hidden: ')}{switchedOff.map(names).join(', ')}</span>}</>}{missing.map(([id,list])=><span key={id} className="operating-profile-change warn"><TriangleAlert size={11} aria-hidden="true"/>{tx('Προσοχή: ','Warning: ')}{names(id)}{tx(' χρειάζεται και ',' also needs ')}{list.map(names).join(', ')}{tx(' (κλειδωμένο).',' (locked).')}</span>)}</span></div>
        <div className="platform-form-section-actions"><Button disabled={!changed||saving} loading={saving} onClick={save}><Save size={15}/>{tx('Αποθήκευση','Save')}</Button></div></header>
    </section>
  </div>
}
