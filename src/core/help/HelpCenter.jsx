import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronRight, Info, Maximize2, Search, ShieldCheck, X } from 'lucide-react'
import { APP_VERSION, BUILD_ID } from '../version'
import { useLocation } from 'react-router-dom'
import { glossary } from './helpContent'
import { helpManual } from './helpManual'
import { useLanguage } from '../i18n/LanguageContext'
import { useTenant } from '../tenant/TenantContext'
import { navigationFor } from '../../app/navigation'

const resolveManual=(path)=>helpManual[path]||helpManual[Object.keys(helpManual).find(k=>k!=='/'&&path.startsWith(k))]||helpManual['/']
const realScreens={
 surveillance:'/help/screens/surveillance.png',
 prevention:'/help/screens/prevention.png',
 lira:'/help/screens/lira.png',
 quality:'/help/screens/quality.png',
 controls:'/help/screens/controls.png',
 committees:'/help/screens/committees.png',
}

export function HelpCenter({open,onClose}){
 const {pathname}=useLocation(); const {language}=useLanguage(); const {role,membership}=useTenant()
 const [query,setQuery]=useState(''); const [selected,setSelected]=useState(pathname); const [chapter,setChapter]=useState(0); const [imageOpen,setImageOpen]=useState(false); const [mode,setMode]=useState('manual')
 const nav=navigationFor({role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[],hasAssignments:Boolean(membership?.assignments?.length)})
 const visible=nav.map(x=>({...x,manual:helpManual[x.to]})).filter(x=>x.manual)
 const filtered=visible.filter(x=>`${x.manual.title} ${x.manual.summary} ${x.manual.chapters.flat().join(' ')}`.toLowerCase().includes(query.toLowerCase()))
 const current=resolveManual(selected)
 const terms=useMemo(()=>glossary.filter(g=>`${g.term} ${g.el} ${g.en}`.toLowerCase().includes(query.toLowerCase())),[query])
 useEffect(()=>{if(open){setSelected(pathname);setChapter(0)}},[open,pathname])
 if(!open)return null
 return <div className="help-backdrop help-center-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
  <section className="manual-center">
   <header className="manual-topbar">
    <div className="manual-brand"><span>L</span><p><strong>LIMOXIS OBSERVER</strong><small>Help Center</small></p></div>
    <label className="manual-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={mode==='glossary'?'Αναζήτηση ορολογίας...':'Αναζήτηση στο εγχειρίδιο...'}/><kbd>Ctrl K</kbd></label>
    <div className="manual-actions manual-actions-clean"><span>Εγχειρίδιο χρήσης · προσαρμοσμένο στον ρόλο σας</span><button className="manual-close" onClick={onClose}><X size={19}/></button></div>
   </header>
   <div className="manual-body">
    <aside className="manual-sidebar">
     <div className="manual-side-label">ΕΝΟΤΗΤΕΣ ΓΙΑ ΤΟΝ ΡΟΛΟ ΣΑΣ</div>
     <div className="manual-nav">{filtered.map((x,i)=>{const Icon=x.icon||BookOpen;return <button key={x.to} className={selected===x.to&&mode==='manual'?'active':''} onClick={()=>{setMode('manual');setSelected(x.to);setChapter(0)}}><Icon size={15}/><span>{x.manual.title}</span><ChevronRight size={13}/></button>})}</div>
     <div className="manual-side-bottom"><button className={mode==='glossary'?'active':''} onClick={()=>setMode('glossary')}><BookOpen size={15}/><span>Ορολογία</span></button><button className={mode==='about'?'active':''} onClick={()=>setMode('about')}><Info size={15}/><span>Σχετικά / Έκδοση</span></button><div className="manual-version">Έκδοση v{APP_VERSION}<span>Build {BUILD_ID}</span></div></div>
    </aside>

    {mode==='manual'&&<main className="manual-article">
      <div className="manual-breadcrumb">ΟΔΗΓΟΣ ΧΡΗΣΗΣ <ChevronRight size={12}/><span>{current.title}</span>{resolveManual(pathname).title===current.title&&<em>ΤΡΕΧΟΥΣΑ ΟΘΟΝΗ</em>}</div>
      <h1>{current.title}</h1><p className="manual-summary">{current.summary}</p>
      <div className="manual-audience"><ShieldCheck size={15}/><span><b>Αφορά:</b> {current.audience}</span></div>
      <div className="manual-chapter-tabs">{current.chapters.map((c,i)=><button className={chapter===i?'active':''} key={c[0]} onClick={()=>setChapter(i)}><span>{i+1}</span>{c[0]}</button>)}</div>
      <article className="manual-copy"><span className="manual-step-label">ΚΕΦΑΛΑΙΟ {chapter+1} / {current.chapters.length}</span><h2>{current.chapters[chapter][0]}</h2><p>{current.chapters[chapter][1]}</p><h3>Πώς το χρησιμοποιώ</h3><ol>{current.steps.map((s,i)=><li key={s}><b>{i+1}</b><span>{s}</span></li>)}</ol><div className="manual-role-note"><ShieldCheck size={17}/><p><b>Προσαρμοσμένο στον λογαριασμό σας</b><span>Βλέπετε μόνο κεφάλαια και ενότητες στις οποίες ο πραγματικός ρόλος, το scope ή οι πρόσθετες αρμοδιότητές σας δίνουν πρόσβαση.</span></p></div></article>
    </main>}

    {mode==='manual'&&<aside className="manual-preview-pane real-screen-pane"><header><span>ΠΡΑΓΜΑΤΙΚΗ ΟΘΟΝΗ</span><b>{current.title}</b></header>
      <button className="real-screen-thumb" onClick={()=>setImageOpen(true)} title="Μεγέθυνση πραγματικής οθόνης">{realScreens[current.preview]?<img src={realScreens[current.preview]} alt={`Πραγματική οθόνη ${current.title}`}/>:<iframe src={selected} title={`Ζωντανή προεπισκόπηση ${current.title}`} tabIndex="-1"/>}<span><Maximize2 size={14}/>Μεγέθυνση εικόνας</span></button>
      <section className="manual-explain"><h3>Τι βλέπετε στην οθόνη</h3><div><b>1</b><p><strong>{realScreens[current.preview]?'Πραγματικό screenshot':'Πραγματικό UI'}</strong><span>{realScreens[current.preview]?'Η εικόνα προέρχεται από την πραγματική οθόνη του Limoxis Observer και αποθηκεύεται μαζί με το εγχειρίδιο.':'Όπου δεν έχει καταχωρηθεί ακόμη screenshot, εμφανίζεται read-only live preview της πραγματικής ενότητας.'}</span></p></div><div><b>2</b><p><strong>Μεγέθυνση</strong><span>Πατήστε τη μικρογραφία για καθαρή μεγάλη προβολή χωρίς να φύγετε από το εγχειρίδιο.</span></p></div></section>
    </aside>}
    {imageOpen&&<div className="manual-image-lightbox" onMouseDown={e=>e.target===e.currentTarget&&setImageOpen(false)}><section><header><div><small>ΠΡΑΓΜΑΤΙΚΗ ΟΘΟΝΗ</small><strong>{current.title}</strong></div><button onClick={()=>setImageOpen(false)}><X size={19}/></button></header><div className="manual-live-large">{realScreens[current.preview]?<img src={realScreens[current.preview]} alt={`Μεγέθυνση πραγματικής οθόνης ${current.title}`}/>:<iframe src={selected} title={`Μεγέθυνση ${current.title}`} tabIndex="-1"/>}</div><footer>{realScreens[current.preview]?'Πραγματικό screenshot της αντίστοιχης οθόνης του Limoxis Observer.':'Read-only live preview της πραγματικής οθόνης του Limoxis Observer.'}</footer></section></div>}

    {mode==='glossary'&&<main className="manual-special"><span className="manual-step-label">ΟΡΟΛΟΓΙΑ</span><h1>Κλινικοί & λειτουργικοί όροι</h1><p>Οι όροι που χρησιμοποιούνται μέσα στο Limoxis Observer.</p><div className="manual-glossary">{terms.map(g=><div key={g.term}><strong>{g.term}</strong><span>{language==='el'?g.el:g.en}</span></div>)}</div></main>}
    {mode==='about'&&<main className="manual-special manual-about"><span className="manual-step-label">LIMOXIS OBSERVER</span><h1>Σχετικά με την εφαρμογή</h1><p>Hospital Infection Prevention, Surveillance & Governance platform.</p><div className="manual-about-grid"><section><small>ΤΡΕΧΟΥΣΑ ΕΚΔΟΣΗ</small><strong>v{APP_VERSION}</strong><span>Build {BUILD_ID}</span></section><section><small>ΠΡΟΣΒΑΣΗ</small><strong>Role + Scope</strong><span>Capabilities & assignments</span></section><section><small>ΓΛΩΣΣΕΣ</small><strong>EL / EN</strong><span>Ενιαίο περιβάλλον</span></section><section><small>ΔΙΑΚΥΒΕΡΝΗΣΗ</small><strong>Traceability</strong><span>Audit-aware workflows</span></section></div><div className="manual-about-text"><h2>Σκοπός</h2><p>Το Limoxis Observer οργανώνει την καθημερινή εργασία πρόληψης και ελέγχου λοιμώξεων σε ένα ενιαίο περιβάλλον. Η εμπειρία προσαρμόζεται στον πραγματικό χρήστη: το menu, οι οθόνες, οι ενέργειες, οι ειδοποιήσεις και αυτό το εγχειρίδιο ακολουθούν τον ίδιο μηχανισμό πρόσβασης.</p></div></main>}
   </div>
  </section>
 </div>
}
