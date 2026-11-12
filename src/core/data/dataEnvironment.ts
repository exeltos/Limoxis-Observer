// Πού γράφουν και διαβάζουν τα δεδομένα: η παραγωγή (ανά οργανισμό) ή το demo (ανά λογαριασμό).
export interface DataEnvironment {
  mode: 'production' | 'demo'
  organizationId: string | null
  demoAccountId: string | null
}

const state: DataEnvironment={mode:'production',organizationId:null,demoAccountId:null}

function normalizePartitionPart(value: string | null, fallback: string){
  const text=String(value||'').trim()
  return text?text.replace(/[^a-zA-Z0-9._-]/g,'_'):fallback
}

export function configureDataEnvironment({mode='production',organizationId=null,demoAccountId=null}:{mode?:string,organizationId?:string|null,demoAccountId?:string|null}={}): void{
  state.mode=mode==='demo'?'demo':'production'
  state.organizationId=organizationId||null
  state.demoAccountId=state.mode==='demo'?(demoAccountId||null):null
}

export const isDemoDataEnvironment=(): boolean=>state.mode==='demo'
export const dataEnvironment=(): DataEnvironment=>({...state})
export const dataPartitionKey=(): string=>{
  if(state.mode==='demo'){
    const account=normalizePartitionPart(state.demoAccountId,'owner-preview')
    return `demo.${account}`
  }
  return `org.${normalizePartitionPart(state.organizationId,'anonymous')}`
}

function emptyShape(value: unknown): unknown{
  if(Array.isArray(value))return []
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,emptyShape(item)]))
  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the caller's fallback shape, emptied
export const environmentFallback=<T,>(fallback: T): any=>isDemoDataEnvironment()?structuredClone(fallback):emptyShape(fallback)
