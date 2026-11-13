import { useMemo } from 'react'
import { LogOut } from 'lucide-react'
import { useFeedback } from '../../core/feedback/FeedbackContext'
import { useAuth } from '../../core/auth/AuthContext'
import { endLoginSessions } from './platformAuditService'
import { deviceLabel } from './loginSessionsModel'
import type { Translate } from '../../types/featureTypes'
import type { LoginSession } from './platformTypes'

// The sign-in a «⋯» ends: the session, its user and how it is named in the confirmation.
type EndableSession = Partial<Pick<LoginSession,'sessionId'|'userId'|'fullName'|'username'|'lastIp'|'ip'|'userAgent'>>

// The «⋯» of an open sign-in (Ιστορικό & Υγεία › Συνδέσεις, Οργανισμός › Δραστηριότητα › Συνδέσεις):
// end this session, or sign the user out of every device, after a confirmation.
export function useEndLoginSessions({tx,en=false,onDone}: {tx: Translate,en?: boolean,onDone?: ()=>unknown}){
  const {confirm,notify,notifyError}=useFeedback()
  const {session}=useAuth()
  const ownSessionId=useMemo(()=>{try{const part=String(session?.access_token||'').split('.')[1];return part?JSON.parse(atob(part.replace(/-/g,'+').replace(/_/g,'/')))?.session_id||'':''}catch{return ''}},[session?.access_token])
  async function endSessions(row: EndableSession,all: boolean){
    const own=all?row.userId===session?.user?.id:row.sessionId===ownSessionId
    const ok=await confirm({
      title:all?tx('Αποσύνδεση από όλες τις συσκευές','Sign out of every device'):tx('Τερματισμός σύνδεσης','End this session'),
      message:all
        ?tx(`Ο/Η ${row.fullName||row.username} αποσυνδέεται από κάθε συσκευή μέσα σε 1–2 λεπτά και πρέπει να συνδεθεί ξανά με τον κωδικό του/της.`,`${row.fullName||row.username} is signed out of every device within 1–2 minutes and must sign in again with their password.`)
        :tx(`Η σύνδεση από ${row.lastIp||row.ip||'—'} (${deviceLabel(row.userAgent,en)}) τερματίζεται μέσα σε 1–2 λεπτά.`,`The session from ${row.lastIp||row.ip||'—'} (${deviceLabel(row.userAgent,en)}) ends within 1–2 minutes.`)+(own?tx(' Είναι η δική σας τρέχουσα σύνδεση.',' This is your own current session.'):''),
      confirmLabel:all?tx('Αποσύνδεση παντού','Sign out everywhere'):tx('Τερματισμός','End session'),
      danger:true,
    })
    if(!ok)return
    try{
      const count=await endLoginSessions(all?{userId:row.userId}:{sessionId:row.sessionId})
      notify(tx(`Τερματίστηκαν ${count} συνδέσεις.`,`${count} session(s) ended.`))
      await onDone?.()
    }catch(err){notifyError(err,'save',{operation:'platform_end_login_sessions'})}
  }
  const menuItems=(row: EndableSession)=>[{id:'end',label:tx('Τερματισμός σύνδεσης','End this session'),icon:LogOut,onClick:()=>void endSessions(row,false)},{id:'all',label:tx('Αποσύνδεση από όλες τις συσκευές','Sign out of every device'),icon:LogOut,tone:'danger',onClick:()=>void endSessions(row,true)}]
  return {endSessions,menuItems}
}
