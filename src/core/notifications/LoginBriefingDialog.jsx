import { Bell,Check,ChevronRight,X } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import { Button } from '../../design-system/Button'
import { useNotifications } from './NotificationContext'
import { useAuth } from '../auth/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { useFeedback } from '../feedback/FeedbackContext'

const text={
  el:{kicker:'ΣΗΜΕΡΙΝΗ ΕΝΗΜΕΡΩΣΗ',goodMorning:'Καλημέρα',intro:'Μια σύντομη εικόνα των θεμάτων που χρειάζονται την προσοχή σας.',attention:'Θέματα προς προσοχή',scope:'Οι εργασίες προκύπτουν από τον ρόλο και το πεδίο πρόσβασής σας.',pending:'Εκκρεμότητες & αποτελέσματα',pendingHint:'Επιλέξτε μια εργασία για άμεση μετάβαση στη σχετική ροή.',announcements:'Νέες ανακοινώσεις',announcementsHint:'Ενημερώσεις που απευθύνονται σε εσάς.',noPending:'Δεν υπάρχουν νέες εκκρεμότητες για τον ρόλο σας.',noAnnouncements:'Δεν υπάρχουν νέες ανακοινώσεις.',approve:'Αποδοχή',reject:'Απόρριψη',ack:'Έλαβα γνώση',membershipDecision:'Επιβεβαιώστε την επιλογή σας για τη συμμετοχή στην επιτροπή.',membershipAccepted:'Η συμμετοχή στην επιτροπή έγινε αποδεκτή.',membershipRejected:'Η συμμετοχή στην επιτροπή απορρίφθηκε.',acknowledged:'Η γνώση καταγράφηκε.',ackFailed:'Δεν ήταν δυνατή η καταγραφή γνώσης.',minutes:'Πρακτικά επιτροπής — αναμένεται η έγκρισή σας',membership:'Συμμετοχή σε επιτροπή — αναμένεται η απόφασή σας'},
  en:{kicker:'TODAY’S BRIEFING',goodMorning:'Good morning',intro:'A concise overview of the items that need your attention.',attention:'Items needing attention',scope:'Tasks are based on your role and access scope.',pending:'Pending work & results',pendingHint:'Select an item to open the relevant workflow.',announcements:'New announcements',announcementsHint:'Updates addressed to you.',noPending:'There is no new pending work for your role.',noAnnouncements:'There are no new announcements.',approve:'Accept',reject:'Reject',ack:'Acknowledge',membershipDecision:'Confirm your decision for this committee membership.',membershipAccepted:'Committee membership accepted.',membershipRejected:'Committee membership rejected.',acknowledged:'Acknowledgement recorded.',ackFailed:'Acknowledgement could not be recorded.',minutes:'Committee minutes awaiting your approval',membership:'Committee membership awaiting your decision'},
}

export function LoginBriefingDialog({open,onClose}){
  const {profile}=useAuth(),n=useNotifications(),navigate=useNavigate(),{language}=useLanguage(),{confirm,notify,notifyError}=useFeedback(),[busyId,setBusyId]=useState(null)
  if(!open)return null
  const tx=text[language==='en'?'en':'el']
  const unreadAnnouncements=n.visibleAnnouncements.filter(a=>!n.notificationItems.find(x=>x.id===a.id)?.read).slice(0,3)
  const minutesApprovals=n.committeeMinutesApprovals??[]
  const totalAttention=n.operational.reduce((sum,item)=>sum+(Number(item.count)||0),0)+n.committeeMemberships.length+minutesApprovals.length
  async function answerMembership(item,status){const ok=await confirm({title:status==='approved'?tx.approve:tx.reject,message:tx.membershipDecision,confirmLabel:status==='approved'?tx.approve:tx.reject,danger:status==='rejected'});if(!ok)return;setBusyId(item.id);try{await n.answerCommitteeMembership(item,status);notify(status==='approved'?tx.membershipAccepted:tx.membershipRejected,'success',{operation:'committee_membership'})}catch(err){notifyError(err,'save',{operation:'committee_membership'})}finally{setBusyId(null)}}
  async function acknowledge(item){setBusyId(item.id);try{await n.acknowledgeAnnouncement(item.id);notify(tx.acknowledged,'success',{operation:'announcement_acknowledgement'})}catch(err){notifyError(err,tx.ackFailed,{operation:'announcement_acknowledgement'})}finally{setBusyId(null)}}
  const go=to=>{onClose();navigate(to)}

  return <ObserverDialog width="wide" eyebrow={`${tx.kicker} · ${new Date().toLocaleDateString(language==='en'?'en-GB':'el-GR',{day:'2-digit',month:'long'})}`} title={`${tx.goodMorning}${profile?.fullName?`, ${profile.fullName.split(' ')[0]}`:''}`} subtitle={tx.intro} onClose={onClose} className="login-briefing-dialog">
    <div className="briefing-summary-v2"><div><small>{tx.attention}</small><strong>{totalAttention}</strong></div><span>{tx.scope}</span></div>
    <div className="briefing-sections briefing-sections-v2">
      <section><header><div><strong>{tx.pending}</strong><small>{tx.pendingHint}</small></div><span>{n.operational.length+n.committeeMemberships.length+minutesApprovals.length}</span></header>
        {n.committeeMemberships.map(item=><div key={item.id} className="committee-membership-notification"><span><strong>{item.committeeName}</strong><small>{tx.membership}</small><span className="notification-inline-actions"><Button variant="secondary" disabled={busyId===item.id} onClick={()=>answerMembership(item,'approved')}><Check size={13}/>{tx.approve}</Button><Button variant="secondary" className="button-destructive" disabled={busyId===item.id} onClick={()=>answerMembership(item,'rejected')}><X size={13}/>{tx.reject}</Button></span></span></div>)}
        {minutesApprovals.map(item=><button key={item.id} className="briefing-navigation-row" onClick={()=>go(item.to)}><span><strong>{item.meetingTitle||item.committeeName}</strong><small>{tx.minutes}</small></span><b>1</b><ChevronRight size={15}/></button>)}
        {n.operational.map(item=><button key={item.id} className="briefing-navigation-row" onClick={()=>{n.markRead(item.id);go(item.to)}}><span><strong>{item.title}</strong><small>{item.count} {tx.attention.toLowerCase()}</small></span><b>{item.count}</b><ChevronRight size={15}/></button>)}
        {!n.operational.length&&!n.committeeMemberships.length&&!minutesApprovals.length&&<p className="briefing-empty">{tx.noPending}</p>}
      </section>
      <section><header><div><strong>{tx.announcements}</strong><small>{tx.announcementsHint}</small></div><span>{unreadAnnouncements.length}</span></header>
        {unreadAnnouncements.length?unreadAnnouncements.map(item=>item.requiresAck&&!item.acknowledged?<div key={item.id} className="committee-membership-notification"><span><strong>{item.title}</strong><small>{item.message}</small><span className="notification-inline-actions"><Button variant="secondary" disabled={busyId===item.id} onClick={()=>acknowledge(item)}><Check size={13}/>{tx.ack}</Button></span></span></div>:<button key={item.id} className="briefing-navigation-row" onClick={()=>n.markRead(item.id)}><span><strong>{item.title}</strong><small>{item.message}</small></span><ChevronRight size={15}/></button>):<p className="briefing-empty">{tx.noAnnouncements}</p>}
      </section>
    </div>
    <div className="briefing-footer-v2"><span><Bell size={13}/>{language==='en'?'You can reopen this briefing at any time from the notification bell.':'Η ενημέρωση ανοίγει ξανά οποιαδήποτε στιγμή από το καμπανάκι.'}</span></div>
  </ObserverDialog>
}
