// Short-lived answers of the home page's reads (dashboard_metrics, department_home_period_overview), kept in memory so
// that returning to the home page shows them at once instead of asking the database again (ταχύτητα, 21/11/2026).
// Only reads: a call that writes never goes through here. Each key carries the data environment (dataPartitionKey: the
// hospital in production, the account in the Demo), so the Demo and production never share an answer; a change of
// hospital or of environment empties it, and so do a sign-out (AuthContext) and every successful save ('limoxis:saved').
// Nothing is kept in the browser's storage: a reload starts empty.
import { dataPartitionKey } from './dataEnvironment'

export const READ_CACHE_MS=2*60*1000

const entries=new Map<string, { at: number, promise: Promise<unknown>, value?: unknown, settled: boolean }>()
let partition: string | null=null
let listening=false

export function forgetCachedReads(): void { entries.clear() }

function listen(){
  if(listening||typeof window==='undefined')return
  listening=true
  window.addEventListener('limoxis:saved',forgetCachedReads)
}

// The entries of the current data environment only: another hospital or the Demo starts from nothing.
function current(): Map<string, { at: number, promise: Promise<unknown>, value?: unknown, settled: boolean }> {
  listen()
  const now=dataPartitionKey()
  if(partition!==now){entries.clear();partition=now}
  return entries
}

const keyOf=(name: string,args: unknown)=>`${dataPartitionKey()}|${name}|${JSON.stringify(args??null)}`

// The answer of `read` for these arguments: the one kept, while younger than `ttlMs`, else a new read (one at a time per
// key). A failed read is not kept.
export function cachedRead<T>(name: string,args: unknown,read: ()=>Promise<T>,{ttlMs=READ_CACHE_MS}: { ttlMs?: number }={}): Promise<T> {
  const store=current(),key=keyOf(name,args),now=Date.now(),hit=store.get(key)
  if(hit&&now-hit.at<ttlMs)return hit.promise as Promise<T>
  const entry: { at: number, promise: Promise<unknown>, value?: unknown, settled: boolean }={at:now,promise:Promise.resolve(),settled:false}
  const promise=read()
  entry.promise=promise
  store.set(key,entry)
  promise.then(value=>{entry.value=value;entry.settled=true},()=>{if(store.get(key)===entry)store.delete(key)})
  return promise
}

// The kept answer, at once (no read), while it is fresh: for a screen to show it on its first paint.
export function peekCachedRead<T>(name: string,args: unknown,{ttlMs=READ_CACHE_MS}: { ttlMs?: number }={}): T | undefined {
  const hit=current().get(keyOf(name,args))
  return hit&&hit.settled&&Date.now()-hit.at<ttlMs?hit.value as T:undefined
}
