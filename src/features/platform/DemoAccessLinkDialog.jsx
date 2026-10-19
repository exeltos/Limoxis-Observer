import { useState } from 'react'
import { ClipboardCopy, Mail } from 'lucide-react'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import './demoWizard.css'

// The link that lets a Demo user set a password and sign in, to pass on by
// hand (message, chat) when the invitation email does not arrive.
export function AccessLinkDialog({language,name,email,link,emailSent,onClose}){
  const en=language==='en';const tx=(el,enText)=>en?enText:el
  const [copied,setCopied]=useState(false)
  const copy=async()=>{try{await navigator.clipboard?.writeText(link);setCopied(true)}catch{setCopied(false)}}
  return <ObserverDialog width="standard" eyebrow={tx('Σύνδεσμος πρόσβασης','Access link')} title={name||email} subtitle={emailSent===true?tx(`Στάλθηκε email στο ${email}. Αν δεν φτάσει, στείλτε αυτόν τον σύνδεσμο με άλλο τρόπο.`,`An email was sent to ${email}. If it does not arrive, pass this link on another way.`):tx(`Στείλτε αυτόν τον σύνδεσμο στο ${email} με άλλο τρόπο (μήνυμα, chat). Με αυτόν ορίζει κωδικό και συνδέεται.`,`Pass this link to ${email} another way (message, chat). It lets them set a password and sign in.`)} onClose={onClose} footer={<><Button onClick={copy}><ClipboardCopy size={15}/>{copied?tx('Αντιγράφηκε','Copied'):tx('Αντιγραφή συνδέσμου','Copy link')}</Button></>}>
    <p className="demo-access-link"><Mail size={14}/><code>{link}</code></p>
    <p className="demo-evaluators-empty">{tx('Ο σύνδεσμος ισχύει για περιορισμένο χρόνο και μία χρήση· αν λήξει, πάρτε νέο από εδώ.','The link is valid for a limited time and one use; if it expires, get a new one here.')}</p>
  </ObserverDialog>
}
