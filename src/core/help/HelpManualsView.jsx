import { useState } from 'react'
import { Copy, Download, ExternalLink, FileText, Mail, Share2 } from 'lucide-react'
import { APP_VERSION } from '../version'
import { useOptionalFeedback } from '../feedback/FeedbackContext'

// Platform Owner only: the printable manuals (public/manual, built by
// tools/build-manual-pdf.mjs) to download, or to share by link or e-mail.
// Links always point at the public domain so they work for the recipient.
const APP_ORIGIN='https://www.limoxis.com'
const APP_HOSTS=['www.limoxis.com','limoxis-observer.netlify.app']
const MANUALS=[
 {id:'el',file:'Limoxis-Observer-Odigos-EL.pdf',el:'Εγχειρίδιο (Ελληνικά)',en:'Manual (Greek)'},
 {id:'en',file:'Limoxis-Observer-Guide-EN.pdf',el:'Εγχειρίδιο (Αγγλικά)',en:'Manual (English)'},
]
const text={
 el:{eyebrow:'ΜΟΝΟ ΓΙΑ PLATFORM OWNER',title:'Εγχειρίδια',body:'Τα εικονογραφημένα εγχειρίδια της εφαρμογής σε PDF, με μία εικόνα ανά ενότητα από δεδομένα demo. Κατεβάστε τα ή στείλτε τον σύνδεσμο σε νοσοκομεία και συνεργάτες: ο σύνδεσμος ανοίγει χωρίς σύνδεση στην εφαρμογή.',version:'Έκδοση εφαρμογής',open:'Άνοιγμα',download:'Λήψη',copy:'Αντιγραφή συνδέσμου',copied:'Ο σύνδεσμος αντιγράφηκε.',copyFailed:'Δεν ήταν δυνατή η αντιγραφή. Επιλέξτε τον σύνδεσμο και αντιγράψτε τον.',email:'Αποστολή με email',share:'Κοινοποίηση',subject:'Εγχειρίδιο Limoxis Observer',mailBody:'Καλησπέρα,\n\nΣας στέλνω το εγχειρίδιο του Limoxis Observer:\n',note:'Ο σύνδεσμος είναι δημόσιος για όποιον τον έχει, αλλά δεν εμφανίζεται σε μηχανές αναζήτησης. Τα εγχειρίδια περιέχουν μόνο δεδομένα demo.'},
 en:{eyebrow:'PLATFORM OWNER ONLY',title:'Manuals',body:'The illustrated PDF manuals of the application, with one screenshot per module from demo data. Download them, or send the link to hospitals and partners: it opens without signing in.',version:'Application version',open:'Open',download:'Download',copy:'Copy link',copied:'Link copied.',copyFailed:'Could not copy. Select the link and copy it.',email:'Send by email',share:'Share',subject:'Limoxis Observer manual',mailBody:'Hello,\n\nHere is the Limoxis Observer manual:\n',note:'Anyone with the link can open it, but it is not listed by search engines. The manuals contain demo data only.'},
}
export const manualUrl=(file,host=typeof window!=='undefined'?window.location:null)=>`${host&&APP_HOSTS.includes(host.hostname)?host.origin:APP_ORIGIN}/manual/${file}`

export function HelpManualsView({language}){
 const t=text[language==='en'?'en':'el'];const feedback=useOptionalFeedback();const [copied,setCopied]=useState('')
 const canShare=typeof navigator!=='undefined'&&typeof navigator.share==='function'
 async function copy(item,url){
  try{await navigator.clipboard.writeText(url);setCopied(item.id);feedback?.notify(t.copied,'info')}
  catch{feedback?.notify(t.copyFailed,'error')}
 }
 return <main className="manual-special manual-downloads">
  <span className="manual-step-label">{t.eyebrow}</span>
  <h1>{t.title}</h1>
  <p>{t.body}</p>
  <div className="manual-download-list">{MANUALS.map(item=>{
   const url=manualUrl(item.file),name=item[language==='en'?'en':'el']
   const mailto=`mailto:?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(`${t.mailBody}${url}\n`)}`
   return <section key={item.id} className="manual-download-card">
    <div className="manual-download-head"><FileText size={22}/><p><strong>{name}</strong><small>{t.version} v{APP_VERSION} · PDF</small></p></div>
    <input className="manual-download-link" readOnly value={url} aria-label={name} onFocus={e=>e.target.select()}/>
    <div className="manual-download-actions">
     <a className="button button-primary" href={url} download={item.file}><Download size={15}/>{t.download}</a>
     <a className="button button-secondary" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>{t.open}</a>
     <button type="button" className="button button-secondary" onClick={()=>copy(item,url)}><Copy size={15}/>{copied===item.id?t.copied:t.copy}</button>
     <a className="button button-secondary" href={mailto}><Mail size={15}/>{t.email}</a>
     {canShare&&<button type="button" className="button button-secondary" onClick={()=>navigator.share({title:name,url}).catch(()=>{})}><Share2 size={15}/>{t.share}</button>}
    </div>
   </section>})}</div>
  <p className="manual-download-note">{t.note}</p>
 </main>
}
