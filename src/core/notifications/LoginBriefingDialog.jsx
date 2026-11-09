import { Bell,Check,ChevronRight,Lightbulb,Sparkles,X } from 'lucide-react'
import { useEffect,useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { useNotifications } from './NotificationContext'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { useFeedback } from '../feedback/FeedbackContext'
import './notificationCenter.css'

const text={
  el:{kicker:'ΣΗΜΕΡΙΝΗ ΕΝΗΜΕΡΩΣΗ',goodMorning:'Καλημέρα',intro:'Μια σύντομη εικόνα των θεμάτων που χρειάζονται την προσοχή σας.',attention:'Θέματα προς προσοχή',scope:'Οι εργασίες προκύπτουν από τον ρόλο και το πεδίο πρόσβασής σας.',pending:'Εκκρεμότητες & αποτελέσματα',pendingHint:'Επιλέξτε μια εργασία για άμεση μετάβαση στη σχετική ροή.',announcements:'Νέες ανακοινώσεις',announcementsHint:'Ενημερώσεις που απευθύνονται σε εσάς.',noPending:'Δεν υπάρχουν νέες εκκρεμότητες για τον ρόλο σας.',noAnnouncements:'Δεν υπάρχουν νέες ανακοινώσεις.',approve:'Αποδοχή',reject:'Απόρριψη',ack:'Έλαβα γνώση',membershipDecision:'Επιβεβαιώστε την επιλογή σας για τη συμμετοχή στην επιτροπή.',membershipAccepted:'Η συμμετοχή στην επιτροπή έγινε αποδεκτή.',membershipRejected:'Η συμμετοχή στην επιτροπή απορρίφθηκε.',acknowledged:'Η γνώση καταγράφηκε.',ackFailed:'Δεν ήταν δυνατή η καταγραφή γνώσης.',minutes:'Πρακτικά επιτροπής — αναμένεται η έγκρισή σας',membership:'Συμμετοχή σε επιτροπή — αναμένεται η απόφασή σας',tipTitle:'Συμβουλή',allClear:'Όλα σε τάξη σήμερα — δεν περιμένει τίποτα εσάς.',needsYou:n=>n===1?'1 θέμα περιμένει την προσοχή σας.':`${n} θέματα περιμένουν την προσοχή σας.`,bell:'Ανοίγει ξανά από το καμπανάκι.',tips:['Στη λίστα Δεικτών, η στήλη «Στόχος» δείχνει τον στόχο του έτους· πατήστε «Ορισμός στόχου έτους» όπου λείπει.','Σε κάθε εγγραφή, το μενού «⋯» πάνω δεξιά έχει Επεξεργασία, Διόρθωση και Διαγραφή.','Το μενού «Εξαγωγή» των λιστών εκτυπώνει ή αποθηκεύει ακριβώς ό,τι δείχνει το φίλτρο που έχετε επιλέξει.','Το κουμπί βοήθειας κάτω δεξιά εξηγεί την οθόνη που βλέπετε και πώς να ξεκινήσετε.','Ένας δείκτης με κόκκινο χρειάζεται δράση: ανοίξτε τον και δείτε αριθμητή και παρονομαστή.']},
  en:{kicker:'TODAY’S BRIEFING',goodMorning:'Good morning',intro:'A concise overview of the items that need your attention.',attention:'Items needing attention',scope:'Tasks are based on your role and access scope.',pending:'Pending work & results',pendingHint:'Select an item to open the relevant workflow.',announcements:'New announcements',announcementsHint:'Updates addressed to you.',noPending:'There is no new pending work for your role.',noAnnouncements:'There are no new announcements.',approve:'Accept',reject:'Reject',ack:'Acknowledge',membershipDecision:'Confirm your decision for this committee membership.',membershipAccepted:'Committee membership accepted.',membershipRejected:'Committee membership rejected.',acknowledged:'Acknowledgement recorded.',ackFailed:'Acknowledgement could not be recorded.',minutes:'Committee minutes awaiting your approval',membership:'Committee membership awaiting your decision',tipTitle:'Tip',allClear:'All clear today — nothing is waiting for you.',needsYou:n=>n===1?'1 item needs your attention.':`${n} items need your attention.`,bell:'Reopen it any time from the bell.',tips:['In the Indicators list, the «Target» column shows the year’s objective; press «Set year objective» where it is missing.','On every record, the «⋯» menu at the top right holds Edit, Correct and Delete.','The «Export» menu of lists prints or saves exactly what the selected filter shows.','The help button at the bottom right explains the screen you are on and how to start.','A red indicator needs action: open it and read the numerator and denominator.']},
}

export function LoginBriefingDialog({open,onClose}){
  const [tipIndex,setTipIndex]=useState(()=>new Date().getDate())
  useEffect(()=>{if(!open)return undefined;const id=window.setInterval(()=>setTipIndex(i=>i+1),9000);return()=>window.clearInterval(id)},[open])
  const {profile}=useAuth(),n=useNotifications(),navigate=useNavigate(),{language}=useLanguage(),{confirm,notify,notifyError}=useFeedback(),[busyId,setBusyId]=useState(null)
  if(!open)return null
  const tx=text[language==='en'?'en':'el']
  const unreadAnnouncements=n.visibleAnnouncements.filter(a=>!n.notificationItems.find(x=>x.id===a.id)?.read).slice(0,3)
  const minutesApprovals=n.committeeMinutesApprovals??[]
  const totalAttention=n.operational.reduce((sum,item)=>sum+(Number(item.count)||0),0)+n.committeeMemberships.length+minutesApprovals.length
  async function answerMembership(item,status){const ok=await confirm({title:status==='approved'?tx.approve:tx.reject,message:tx.membershipDecision,confirmLabel:status==='approved'?tx.approve:tx.reject,danger:status==='rejected'});if(!ok)return;setBusyId(item.id);try{await n.answerCommitteeMembership(item,status);notify(status==='approved'?tx.membershipAccepted:tx.membershipRejected,'success',{operation:'committee_membership'})}catch(err){notifyError(err,'save',{operation:'committee_membership'})}finally{setBusyId(null)}}
  async function acknowledge(item){setBusyId(item.id);try{await n.acknowledgeAnnouncement(item.id);notify(tx.acknowledged,'success',{operation:'announcement_acknowledgement'})}catch(err){notifyError(err,tx.ackFailed,{operation:'announcement_acknowledgement'})}finally{setBusyId(null)}}
  const go=to=>{onClose();navigate(to)}

  return <ObserverDialog width="standard" eyebrow={`${tx.kicker} · ${new Date().toLocaleDateString(language==='en'?'en-GB':'el-GR',{day:'2-digit',month:'long'})}`} title={`${tx.goodMorning}${profile?.fullName?`, ${profile.fullName.split(' ')[0]}`:''}`} subtitle={tx.intro} onClose={onClose} className="login-briefing-dialog">
    <div className="briefing-hero"><span className="briefing-hero-icon"><Sparkles size={18}/></span><p>{totalAttention>0?tx.needsYou(totalAttention):tx.allClear}</p></div>
    {(n.operational.length>0||n.committeeMemberships.length>0||minutesApprovals.length>0)&&<section className="briefing-flat"><h3>{tx.pending}</h3>
      {n.committeeMemberships.map(item=><div key={item.id} className="committee-membership-notification"><span><strong>{item.committeeName}</strong><small>{tx.membership}</small><span className="notification-inline-actions"><Button variant="secondary" disabled={busyId===item.id} onClick={()=>answerMembership(item,'approved')}><Check size={13}/>{tx.approve}</Button><Button variant="secondary" className="button-destructive" disabled={busyId===item.id} onClick={()=>answerMembership(item,'rejected')}><X size={13}/>{tx.reject}</Button></span></span></div>)}
      {minutesApprovals.map(item=><button key={item.id} className="briefing-navigation-row" onClick={()=>go(item.to)}><span><strong>{item.meetingTitle||item.committeeName}</strong><small>{tx.minutes}</small></span><b>1</b><ChevronRight size={15}/></button>)}
      {n.operational.map(item=><button key={item.id} className="briefing-navigation-row" onClick={()=>{n.markRead(item.id);go(item.to)}}><span><strong>{item.title}</strong></span><b>{item.count}</b><ChevronRight size={15}/></button>)}
    </section>}
    {unreadAnnouncements.length>0&&<section className="briefing-flat"><h3>{tx.announcements}</h3>
      {unreadAnnouncements.map(item=>item.requiresAck&&!item.acknowledged?<div key={item.id} className="committee-membership-notification"><span><strong>{item.title}</strong><small>{item.message}</small><span className="notification-inline-actions"><Button variant="secondary" disabled={busyId===item.id} onClick={()=>acknowledge(item)}><Check size={13}/>{tx.ack}</Button></span></span></div>:<button key={item.id} className="briefing-navigation-row" onClick={()=>n.markRead(item.id)}><span><strong>{item.title}</strong><small>{item.message}</small></span><ChevronRight size={15}/></button>)}
    </section>}
    <aside className="briefing-tip" aria-live="polite"><span className="briefing-tip-icon"><Lightbulb size={18}/></span><div key={tipIndex%tx.tips.length} className="briefing-tip-text"><strong>{tx.tipTitle}</strong><p>{tx.tips[tipIndex%tx.tips.length]}</p></div></aside>
    <div className="briefing-footer-flat"><Bell size={13}/>{tx.bell}</div>
  </ObserverDialog>
}
