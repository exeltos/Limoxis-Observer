// Small values kept in the user's own browser so a screen can show its last numbers at once and refresh them in the
// background (ταχύτητα, ιδιοκτήτης 16/11/2026). Every key carries the signed-in user, so one user never sees another's;
// everything here is removed on sign-out (AuthContext). Only what the user could already see: no new data reaches the browser.
const PREFIX='limoxis.userCache.v1|'

function storage(): Storage | null {
  try { return typeof window!=='undefined'?window.localStorage:null } catch { return null }
}

export function readUserCache<T>(key: string): T | null {
  try {
    const raw=storage()?.getItem(PREFIX+key)
    return raw?JSON.parse(raw) as T:null
  } catch { return null }
}

export function writeUserCache(key: string, value: unknown): void {
  try { storage()?.setItem(PREFIX+key,JSON.stringify(value)) } catch { /* full or blocked storage: the screen just loads as before */ }
}

export function clearUserCache(): void {
  const store=storage()
  if(!store)return
  try {
    const keys: string[]=[]
    for(let i=0;i<store.length;i+=1){const key=store.key(i);if(key?.startsWith(PREFIX))keys.push(key)}
    for(const key of keys)store.removeItem(key)
  } catch { /* storage unavailable */ }
}
