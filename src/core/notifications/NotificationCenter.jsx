import { Bell, CheckCheck, ChevronRight, Gift, Megaphone, PartyPopper, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from './NotificationContext'
import { useAuth } from '../auth/AuthContext'

export function NotificationCenter({open,onClose,onOpenBriefing,onOpenBirthday}){
 const n=useNotifications(); const navigate=useNavigate()
 if(!open)return null
 const go=item=>{n.markRead(item.id);if(item.to){onClose();navigate(item.to)}}
 return <div className="notification-popover">
  <header><div><Bell size={17}/><strong>Ειδοποιήσεις</strong><span>{n.unreadCount} μη αναγνωσμένες</span></div><button onClick={onClose}><X size={16}/></button></header>
  <div className="notification-toolbar notification-toolbar-actions">{n.unreadCount>0&&<button onClick={n.markAllRead}><CheckCheck size={14}/>Όλα αναγνωσμένα</button>}</div><div className="notification-recovery"><span>Χάσατε την ενημέρωση εισόδου;</span><button onClick={onOpenBriefing}>Άνοιγμα ενημέρωσης</button>{n.birthday.length>0&&<button onClick={onOpenBirthday}><Gift size={13}/>Ευχή γενεθλίων</button>}</div>
  <div className="notification-list">{n.unreadItems.length?n.unreadItems.map(item=><button key={item.id} className="notification-row unread" onClick={()=>go(item)}><span className={`notification-type ${item.type}`}>{item.type==='announcement'?<Megaphone size={15}/>:<Bell size={15}/>}</span><span><strong>{item.title}</strong><small>{item.message||`${item.count} στοιχεία χρειάζονται προσοχή`}</small></span><ChevronRight size={14}/></button>):<div className="notification-empty"><CheckCheck size={20}/><strong>Είστε ενημερωμένοι</strong><span>Δεν υπάρχουν μη αναγνωσμένες ειδοποιήσεις.</span></div>}</div>
 </div>
}

export function BirthdayGreeting({open,onClose}){
 const n=useNotifications()
 if(!open||!n.birthday.length)return null
 return <div className="modal-backdrop birthday-popup-backdrop"><section className="birthday-popup" role="dialog" aria-modal="true">
  <div className="birthday-confetti">✦ · ✧ · ✦</div><span className="birthday-icon"><PartyPopper size={28}/></span>
  <small>ΜΙΑ ΟΜΟΡΦΗ ΣΤΙΓΜΗ ΓΙΑ ΤΗΝ ΟΜΑΔΑ ΜΑΣ</small>
  <h2>Χρόνια πολλά!</h2>
  <p>{n.birthday.map(e=>`${e.firstName} ${e.lastName}`).join(', ')} {n.birthday.length===1?'έχει':'έχουν'} γενέθλια σήμερα.</p>
  <span className="birthday-wish">Με υγεία, χαρά και όμορφες στιγμές.</span>
  <button className="button primary" onClick={onClose}>Ευχαριστώ</button>
 </section></div>
}

export function LoginBriefing({open,onClose}){
 const {profile}=useAuth(); const n=useNotifications(); const navigate=useNavigate()
 if(!open)return null
 return <div className="modal-backdrop briefing-backdrop"><section className="login-briefing" role="dialog" aria-modal="true">
  <header><div><span className="briefing-kicker">ΣΗΜΕΡΑ · {new Date().toLocaleDateString('el-GR',{day:'2-digit',month:'long'})}</span><h2>Καλημέρα{profile?.fullName?`, ${profile.fullName.split(' ')[0]}`:''}</h2><p>Η επιχειρησιακή ενημέρωση που αφορά τον ρόλο και το scope σας.</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></header>
  <div className="briefing-sections">
   <div><h3>Εκκρεμότητες & αποτελέσματα</h3>{n.operational.length?n.operational.map(item=><button key={item.id} onClick={()=>{n.markRead(item.id);onClose();navigate(item.to)}}><span>{item.title}</span><b>{item.count}</b><ChevronRight size={14}/></button>):<p className="briefing-empty">Δεν υπάρχουν νέες εκκρεμότητες για τον ρόλο σας.</p>}</div>
   <div><h3>Νέες ανακοινώσεις</h3>{n.visibleAnnouncements.filter(a=>!n.notificationItems.find(x=>x.id===a.id)?.read).slice(0,3).length?n.visibleAnnouncements.filter(a=>!n.notificationItems.find(x=>x.id===a.id)?.read).slice(0,3).map(item=><button key={item.id} onClick={()=>n.markRead(item.id)}><span><strong>{item.title}</strong><small>{item.message}</small></span><i/></button>):<p className="briefing-empty">Δεν υπάρχουν νέες ανακοινώσεις.</p>}</div>
  </div>
  <footer><span>Μπορείτε να ξανανοίξετε την ενημέρωση οποιαδήποτε στιγμή από το κουδουνάκι.</span><button className="button secondary" onClick={onClose}>Κλείσιμο</button><button className="button primary" onClick={()=>{onClose();navigate('/')}}>Dashboard</button></footer>
 </section></div>
}
