import { useEffect,useRef,useState } from 'react'
import { createPortal } from 'react-dom'
import { Eye,EyeOff,Lock,LogIn } from 'lucide-react'
import { supabase } from '../core/supabase/client'
import { readLocalValue,readSessionValue,removeSessionValue,writeLocalValue,writeSessionValue } from '../core/storage/browserStorage'
import './idleLock.css'

const LOCK_KEY='limoxis.screenLocked'
const ACTIVITY_EVENTS=['pointerdown','pointermove','keydown','wheel','touchstart']
// How often the idle time is checked (the lock may come up to this much later
// than the setting).
const CHECK_MS=15000
export const DEFAULT_IDLE_LOCK_MINUTES=15
export const IDLE_LOCK_OPTIONS=[0,5,10,15,30,60]

const readLocked=()=>readSessionValue(LOCK_KEY)==='1'
const writeLocked=value=>{if(value)writeSessionValue(LOCK_KEY,'1');else removeSessionValue(LOCK_KEY)}

const DEMO_MINUTES_KEY='limoxis.demoIdleLockMinutes'
const CHANGED_EVENT='limoxis:idle-lock-changed'

// The organization's idle time. The demo keeps its own on this device; a live
// organization's comes with the membership and is refreshed when an admin
// changes it here (see announceIdleLockMinutes).
export function idleLockMinutesFor(tenant,isDemo){
 const raw=isDemo?readLocalValue(DEMO_MINUTES_KEY,null):tenant?.idle_lock_minutes
 if(raw==null||raw==='')return DEFAULT_IDLE_LOCK_MINUTES
 const value=Number(raw)
 return Number.isFinite(value)&&value>=0?value:DEFAULT_IDLE_LOCK_MINUTES
}
export function announceIdleLockMinutes(minutes,{isDemo=false}={}){
 if(isDemo)writeLocalValue(DEMO_MINUTES_KEY,String(minutes))
 window.dispatchEvent(new CustomEvent(CHANGED_EVENT,{detail:{minutes}}))
}
export function useIdleLockMinutes(tenant,isDemo){
 const [minutes,setMinutes]=useState(()=>idleLockMinutesFor(tenant,isDemo))
 useEffect(()=>{setMinutes(idleLockMinutesFor(tenant,isDemo))},[tenant,isDemo])
 useEffect(()=>{const onChange=event=>setMinutes(Number(event.detail?.minutes)||0);window.addEventListener(CHANGED_EVENT,onChange);return()=>window.removeEventListener(CHANGED_EVENT,onChange)},[])
 return minutes
}

// Clears the lock on sign-out, so the next user starts unlocked.
export const clearIdleLock=()=>writeLocked(false)

// Locks the screen after the hospital's idle time (Management → Organization),
// for shared ward computers and tablets. The app stays mounted behind the
// lock, so nothing typed is lost. The same user unlocks with their password;
// anyone else signs in as themselves. A reload does not skip the lock.
export function IdleLock({minutes,userName,organizationName,email,language,onSwitchUser}){
 const en=language==='en'
 const [locked,setLocked]=useState(readLocked)
 const lastActivity=useRef(Date.now())

 useEffect(()=>{
  if(!minutes||locked)return undefined
  lastActivity.current=Date.now()
  const limit=minutes*60000
  const mark=()=>{lastActivity.current=Date.now()}
  const check=()=>{if(Date.now()-lastActivity.current<limit)return;writeLocked(true);setLocked(true)}
  ACTIVITY_EVENTS.forEach(event=>window.addEventListener(event,mark,{passive:true,capture:true}))
  // A computer or tablet that slept past the idle time locks as soon as it wakes.
  const onShow=()=>{if(!document.hidden)check()}
  document.addEventListener('visibilitychange',onShow)
  const timer=window.setInterval(check,CHECK_MS)
  return()=>{
   ACTIVITY_EVENTS.forEach(event=>window.removeEventListener(event,mark,{capture:true}))
   document.removeEventListener('visibilitychange',onShow)
   window.clearInterval(timer)
  }
 },[minutes,locked])

 // Nothing behind the lock can be reached with the keyboard or a screen reader.
 useEffect(()=>{
  const shell=document.querySelector('.app-shell')
  if(!shell)return undefined
  if(locked)shell.setAttribute('inert','')
  else shell.removeAttribute('inert')
  return()=>shell.removeAttribute('inert')
 },[locked])

 if(!locked)return null
 return createPortal(<LockScreen en={en} userName={userName} organizationName={organizationName} email={email} onUnlock={()=>{writeLocked(false);setLocked(false)}} onSwitchUser={()=>{writeLocked(false);onSwitchUser?.()}}/>,document.body)
}

function LockScreen({en,userName,organizationName,email,onUnlock,onSwitchUser}){
 const [password,setPassword]=useState('')
 const [showPassword,setShowPassword]=useState(false)
 const [error,setError]=useState('')
 const [busy,setBusy]=useState(false)
 // Demo (no account): the lock still hides the screen; there is no password to check.
 const passwordless=!email||!supabase

 async function unlock(event){
  event.preventDefault()
  if(passwordless){onUnlock();return}
  if(!password)return
  setBusy(true);setError('')
  // The email is the signed-in account's own, so only that account's password unlocks.
  const {data,error:signInError}=await supabase.auth.signInWithPassword({email,password})
  setBusy(false)
  if(signInError||!data?.user){setError(en?'Wrong password.':'Λάθος κωδικός.');setPassword('');setShowPassword(false);return}
  setPassword('')
  onUnlock()
 }

 return <div className="idle-lock" role="dialog" aria-modal="true" aria-labelledby="idle-lock-title">
  <form className="idle-lock-card" onSubmit={event=>void unlock(event)}>
   <span className="idle-lock-icon" aria-hidden="true"><Lock size={26}/></span>
   <h2 id="idle-lock-title">{en?'Screen locked':'Η οθόνη κλειδώθηκε'}</h2>
   <p>{en?'Locked after inactivity. Whatever was open stays as it was.':'Κλείδωσε λόγω αδράνειας. Ό,τι ήταν ανοιχτό παραμένει όπως ήταν.'}</p>
   <div className="idle-lock-user"><b>{userName}</b>{organizationName&&<small>{organizationName}</small>}</div>
   {!passwordless&&<label>
    <span>{en?'Password':'Κωδικός'}</span>
    <div className="idle-lock-password">
     <input type={showPassword?'text':'password'} autoFocus autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)} disabled={busy}/>
     <button type="button" onClick={()=>setShowPassword(shown=>!shown)} aria-pressed={showPassword} aria-label={showPassword?(en?'Hide password':'Απόκρυψη κωδικού'):(en?'Show password':'Εμφάνιση κωδικού')} title={showPassword?(en?'Hide password':'Απόκρυψη κωδικού'):(en?'Show password':'Εμφάνιση κωδικού')}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button>
    </div>
   </label>}
   {error&&<p className="idle-lock-error" role="alert">{error}</p>}
   <button type="submit" className="idle-lock-unlock" disabled={busy||(!passwordless&&!password)}>{busy?(en?'Checking…':'Έλεγχος…'):(en?'Unlock':'Ξεκλείδωμα')}</button>
   {onSwitchUser&&<button type="button" className="idle-lock-switch" onClick={onSwitchUser}><LogIn size={15}/>{en?'Sign in as another user':'Σύνδεση με άλλο χρήστη'}</button>}
  </form>
 </div>
}
