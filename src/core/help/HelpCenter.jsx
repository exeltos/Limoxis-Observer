import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Info, Maximize2, Search, ShieldCheck, Sparkles, X } from 'lucide-react'
import { APP_VERSION, BUILD_ID } from '../version'
import { useLocation } from 'react-router-dom'
import { glossary } from './helpContent'
import { helpManual } from './helpManual'
import { helpManualEn } from './helpManualEn'
import { helpExtras } from './helpExtras'
import { useLanguage } from '../i18n/LanguageContext'
import { useTenant } from '../tenant/TenantContext'
import { navigationFor } from '../../app/navigation'

const NETLIFY_ORIGIN='https://limoxis-observer.netlify.app'
const netlifyPreviewUrl=(path,role,language)=>{
 const base=typeof window!=='undefined'&&window.location.hostname==='limoxis-observer.netlify.app'?window.location.origin:NETLIFY_ORIGIN
 const url=new URL(path||'/',base)
 url.searchParams.set('helpPreview','1')
 if(role)url.searchParams.set('helpRole',role)
 if(language)url.searchParams.set('helpLang',language)
 return url.toString()
}
const resolveManual=(path,book)=>book[path]||book[Object.keys(book).find(k=>k!=='/'&&path.startsWith(k))]||book['/']

const uiText={
 el:{
  center:'Κέντρο Βοήθειας & Πληροφοριών',guide:'Οδηγός χρήσης Limoxis Observer',
  searchGuide:'Αναζήτηση στο εγχειρίδιο...',searchGlossary:'Αναζήτηση ορολογίας...',
  roleGuide:'Εγχειρίδιο προσαρμοσμένο στον ρόλο σας',sectionsForRole:'ΕΝΟΤΗΤΕΣ ΓΙΑ ΤΟΝ ΡΟΛΟ ΣΑΣ',
  glossary:'Ορολογία',about:'Σχετικά / Έκδοση',version:'Έκδοση',
  currentScreen:'ΤΡΕΧΟΥΣΑ ΟΘΟΝΗ',userGuide:'ΟΔΗΓΟΣ ΧΡΗΣΗΣ',forRole:'Αφορά',
  chapter:'ΚΕΦΑΛΑΙΟ',howTo:'Πώς το χρησιμοποιώ',beforeFinish:'Έλεγχος πριν ολοκληρώσετε',
  goodPractice:'Καλή πρακτική',roleAware:'Προσαρμοσμένο στον λογαριασμό σας',
  roleAwareBody:'Βλέπετε μόνο κεφάλαια και ενότητες στις οποίες ο πραγματικός ρόλος, το scope ή οι πρόσθετες αρμοδιότητές σας δίνουν πρόσβαση.',
  previous:'Προηγούμενο',next:'Επόμενο',related:'Σχετικές ενότητες',
  liveScreen:'ΖΩΝΤΑΝΗ ΟΘΟΝΗ ΑΠΟ NETLIFY',zoom:'Μεγέθυνση',closeZoom:'Κλείσιμο μεγέθυνσης',
  realScreen:'Πραγματική εικόνα εφαρμογής',liveTitle:'Live από το Netlify',
  liveBody:'Η μικρογραφία φορτώνει την πραγματική δημοσιευμένη οθόνη του Limoxis Observer.',
  updatedTitle:'Πάντα ενημερωμένη',updatedBody:'Με κάθε νέο Netlify deploy η προεπισκόπηση ακολουθεί αυτόματα την τρέχουσα έκδοση.',
  glossaryEyebrow:'ΟΡΟΛΟΓΙΑ',glossaryTitle:'Κλινικοί & λειτουργικοί όροι',glossaryBody:'Οι όροι που χρησιμοποιούνται μέσα στο Limoxis Observer.',
  aboutTitle:'Σχετικά με την εφαρμογή',currentVersion:'ΤΡΕΧΟΥΣΑ ΕΚΔΟΣΗ',access:'ΠΡΟΣΒΑΣΗ',languages:'ΓΛΩΣΣΕΣ',governance:'ΔΙΑΚΥΒΕΡΝΗΣΗ',
  purpose:'Σκοπός',purposeBody:'Το Limoxis Observer οργανώνει την καθημερινή εργασία πρόληψης και ελέγχου λοιμώξεων σε ένα ενιαίο περιβάλλον. Η εμπειρία προσαρμόζεται στον πραγματικό χρήστη: menu, οθόνες, ενέργειες, ειδοποιήσεις και εγχειρίδιο ακολουθούν τον ίδιο μηχανισμό πρόσβασης.',
  noResults:'Δεν βρέθηκε ενότητα με αυτόν τον όρο.'
 },
 en:{
  center:'Help & Information Center',guide:'Limoxis Observer User Guide',
  searchGuide:'Search the user guide...',searchGlossary:'Search terminology...',
  roleGuide:'User guide tailored to your role',sectionsForRole:'SECTIONS AVAILABLE TO YOUR ROLE',
  glossary:'Glossary',about:'About / Version',version:'Version',
  currentScreen:'CURRENT SCREEN',userGuide:'USER GUIDE',forRole:'For',
  chapter:'CHAPTER',howTo:'How to use it',beforeFinish:'Check before you finish',
  goodPractice:'Good practice',roleAware:'Tailored to your account',
  roleAwareBody:'You see only chapters and modules available to your actual role, organizational scope and additional capabilities.',
  previous:'Previous',next:'Next',related:'Related sections',
  liveScreen:'LIVE SCREEN FROM NETLIFY',zoom:'Enlarge',closeZoom:'Close enlarged preview',
  realScreen:'Real application view',liveTitle:'Live from Netlify',
  liveBody:'The thumbnail loads the real published Limoxis Observer screen.',
  updatedTitle:'Always current',updatedBody:'Each new Netlify deployment automatically updates the preview to the current application version.',
  glossaryEyebrow:'GLOSSARY',glossaryTitle:'Clinical & operational terminology',glossaryBody:'Terms used throughout Limoxis Observer.',
  aboutTitle:'About the application',currentVersion:'CURRENT VERSION',access:'ACCESS',languages:'LANGUAGES',governance:'GOVERNANCE',
  purpose:'Purpose',purposeBody:'Limoxis Observer organizes day-to-day infection prevention and surveillance work in one environment. Menus, screens, actions, notifications and this guide follow the same role-aware access model.',
  noResults:'No section matches this search.'
 }
}

export function HelpCenter({open,onClose}){
 const {pathname}=useLocation()
 const {language}=useLanguage()
 const {role,membership}=useTenant()
 const searchRef=useRef(null)
 const [query,setQuery]=useState('')
 const [selected,setSelected]=useState(pathname)
 const [chapter,setChapter]=useState(0)
 const [imageOpen,setImageOpen]=useState(false)
 const [mode,setMode]=useState('manual')

 const book=language==='en'?helpManualEn:helpManual
 const tx=uiText[language==='en'?'en':'el']
 const nav=navigationFor({role,addOns:membership?.capabilities??[],customCapabilities:membership?.customCapabilities??[],hasAssignments:Boolean(membership?.assignments?.length)})
 const visible=nav.map(x=>({...x,manual:book[x.to]})).filter(x=>x.manual)
 const normalizedQuery=query.trim().toLowerCase()
 const filtered=visible.filter(x=>`${x.manual.title} ${x.manual.summary} ${x.manual.chapters.flat().join(' ')}`.toLowerCase().includes(normalizedQuery))
 const current=resolveManual(selected,book)
 const currentSection=visible.find(x=>pathname===x.to||(x.to!=='/'&&pathname.startsWith(`${x.to}/`)))?.to??'/'
 const extras=helpExtras[selected]||helpExtras['/']
 const checks=extras?.checks?.[language==='en'?'en':'el']||[]
 const tip=extras?.tip?.[language==='en'?'en':'el']||''
 const related=(extras?.related||[]).map(path=>visible.find(x=>x.to===path)).filter(Boolean).slice(0,3)
 const terms=useMemo(()=>glossary.filter(g=>`${g.term} ${g.el} ${g.en}`.toLowerCase().includes(normalizedQuery)),[normalizedQuery])
 const currentChapter=current.chapters[Math.min(chapter,current.chapters.length-1)]||current.chapters[0]
 const isCurrent=resolveManual(pathname,book).title===current.title

 useEffect(()=>{
   if(open){
     setMode('manual')
     setSelected(currentSection)
     setChapter(0)
     setImageOpen(false)
     setQuery('')
   }
 },[open,pathname,currentSection])

 useEffect(()=>{
   if(!open)return undefined
   const onKeyDown=(event)=>{
     if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
       event.preventDefault()
       searchRef.current?.focus()
     }
     if(event.key==='Escape'){
       if(imageOpen)setImageOpen(false)
       else onClose()
     }
   }
   window.addEventListener('keydown',onKeyDown)
   return()=>window.removeEventListener('keydown',onKeyDown)
 },[open,imageOpen,onClose])

 const selectModule=(path)=>{setMode('manual');setSelected(path);setChapter(0);setQuery('')}
 const prevChapter=()=>setChapter(i=>Math.max(0,i-1))
 const nextChapter=()=>setChapter(i=>Math.min(current.chapters.length-1,i+1))

 if(!open)return null

 return <aside className="help-panel-shell" role="dialog" aria-modal="false" aria-label={tx.center}>
  <section className="manual-center">
   <header className="manual-topbar">
    <div className="manual-brand"><span>L</span><p><strong>LIMOXIS OBSERVER</strong><small>{tx.guide}</small></p></div>
    <label className="manual-search"><Search size={15}/><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder={mode==='glossary'?tx.searchGlossary:tx.searchGuide}/><kbd>Ctrl K</kbd></label>
    <div className="manual-actions manual-actions-clean"><span>{tx.roleGuide}</span><button className="manual-close" aria-label={language==='en'?'Close Help Center':'Κλείσιμο Κέντρου Βοήθειας'} onClick={onClose}><X size={19}/></button></div>
   </header>

   <div className="manual-body">
    <aside className="manual-sidebar">
     <div className="manual-side-label">{tx.sectionsForRole}</div>
     <div className="manual-nav">
      {filtered.length?filtered.map((x)=>{const Icon=x.icon||BookOpen;return <button key={x.to} className={selected===x.to&&mode==='manual'?'active':''} onClick={()=>selectModule(x.to)}><Icon size={15}/><span>{x.manual.title}</span><ChevronRight size={13}/></button>}):<div className="manual-nav-empty">{tx.noResults}</div>}
     </div>
     <div className="manual-side-bottom">
      <button className={mode==='glossary'?'active':''} onClick={()=>{setMode('glossary');setQuery('')}}><BookOpen size={15}/><span>{tx.glossary}</span></button>
      <button className={mode==='about'?'active':''} onClick={()=>{setMode('about');setQuery('')}}><Info size={15}/><span>{tx.about}</span></button>
      <div className="manual-version">{tx.version} v{APP_VERSION}<span>Build {BUILD_ID}</span></div>
     </div>
    </aside>

    {mode==='manual'&&<main className="manual-article">
      <div className="manual-breadcrumb">{tx.userGuide}<ChevronRight size={12}/><span>{current.title}</span>{isCurrent&&<em>{tx.currentScreen}</em>}</div>
      <h1>{current.title}</h1>
      <p className="manual-summary">{current.summary}</p>
      <div className="manual-audience"><ShieldCheck size={15}/><span><b>{tx.forRole}:</b> {current.audience}</span></div>

      <div className="manual-chapter-tabs">{current.chapters.map((c,i)=><button className={chapter===i?'active':''} key={c[0]} onClick={()=>setChapter(i)}><span>{i+1}</span>{c[0]}</button>)}</div>

      <article className="manual-copy manual-copy-v2">
       <span className="manual-step-label">{tx.chapter} {chapter+1} / {current.chapters.length}</span>
       <h2>{currentChapter[0]}</h2>
       <p>{currentChapter[1]}</p>

       <section className="manual-detail-section">
        <h3>{tx.howTo}</h3>
        <ol>{current.steps.map((step,i)=><li key={step}><b>{i+1}</b><span>{step}</span></li>)}</ol>
       </section>

       {checks.length>0&&<section className="manual-check-section">
        <h3><CheckCircle2 size={15}/>{tx.beforeFinish}</h3>
        <ul>{checks.map(item=><li key={item}><CheckCircle2 size={14}/><span>{item}</span></li>)}</ul>
       </section>}

       {tip&&<div className="manual-good-practice"><Sparkles size={16}/><p><b>{tx.goodPractice}</b><span>{tip}</span></p></div>}

       <div className="manual-role-note"><ShieldCheck size={17}/><p><b>{tx.roleAware}</b><span>{tx.roleAwareBody}</span></p></div>

       <footer className="manual-chapter-footer">
        <button disabled={chapter===0} onClick={prevChapter}><ChevronLeft size={14}/>{tx.previous}</button>
        <span>{chapter+1} / {current.chapters.length}</span>
        <button disabled={chapter===current.chapters.length-1} onClick={nextChapter}>{tx.next}<ChevronRight size={14}/></button>
       </footer>
      </article>
    </main>}

    {mode==='manual'&&<aside className="manual-preview-pane real-screen-pane">
      <header><span>{tx.liveScreen}</span><b>{current.title}</b></header>
      <button className="real-screen-thumb netlify-screen-thumb" onClick={()=>setImageOpen(true)} title={tx.zoom}><iframe src={netlifyPreviewUrl(selected,role,language)} title={`Netlify preview ${current.title}`} tabIndex="-1"/><span><Maximize2 size={14}/>{tx.zoom}</span></button>
      <section className="manual-explain"><h3>{tx.realScreen}</h3><div><b>1</b><p><strong>{tx.liveTitle}</strong><span>{tx.liveBody}</span></p></div><div><b>2</b><p><strong>{tx.updatedTitle}</strong><span>{tx.updatedBody}</span></p></div></section>
      {related.length>0&&<section className="manual-related"><h3>{tx.related}</h3>{related.map(item=>{const Icon=item.icon||BookOpen;return <button key={item.to} onClick={()=>selectModule(item.to)}><Icon size={14}/><span>{item.manual.title}</span><ChevronRight size={13}/></button>})}</section>}
    </aside>}

    {imageOpen&&<div className="manual-image-lightbox manual-image-lightbox-floating" onMouseDown={e=>e.target===e.currentTarget&&setImageOpen(false)}>
      <div className="manual-preview-floating-card" onMouseDown={e=>e.stopPropagation()}>
        <div className="manual-live-floating"><iframe src={netlifyPreviewUrl(selected,role,language)} title={`Netlify enlarged ${current.title}`} tabIndex="-1"/></div>
        <button className="manual-lightbox-close" aria-label={tx.closeZoom} title={tx.closeZoom} onClick={()=>setImageOpen(false)}><X size={21}/></button>
      </div>
    </div>}

    {mode==='glossary'&&<main className="manual-special"><span className="manual-step-label">{tx.glossaryEyebrow}</span><h1>{tx.glossaryTitle}</h1><p>{tx.glossaryBody}</p><label className="manual-special-search"><Search size={15}/><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder={tx.searchGlossary}/></label><div className="manual-glossary">{terms.map(g=><div key={g.term}><strong>{g.term}</strong><span>{language==='el'?g.el:g.en}</span></div>)}</div></main>}

    {mode==='about'&&<main className="manual-special manual-about"><span className="manual-step-label">LIMOXIS OBSERVER</span><h1>{tx.aboutTitle}</h1><p>Hospital Infection Prevention, Surveillance & Governance platform.</p><div className="manual-about-grid"><section><small>{tx.currentVersion}</small><strong>v{APP_VERSION}</strong><span>Build {BUILD_ID}</span></section><section><small>{tx.access}</small><strong>Role + Scope</strong><span>Capabilities & assignments</span></section><section><small>{tx.languages}</small><strong>EL / EN</strong><span>{language==='en'?'Unified interface':'Ενιαίο περιβάλλον'}</span></section><section><small>{tx.governance}</small><strong>Traceability</strong><span>Audit-aware workflows</span></section></div><div className="manual-about-text"><h2>{tx.purpose}</h2><p>{tx.purposeBody}</p></div></main>}
   </div>
  </section>
 </aside>
}
