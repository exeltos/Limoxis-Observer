const state={mode:'production',organizationId:null,demoAccountId:null}

function normalizePartitionPart(value,fallback){
  const text=String(value||'').trim()
  return text?text.replace(/[^a-zA-Z0-9._-]/g,'_'):fallback
}

export function configureDataEnvironment({mode='production',organizationId=null,demoAccountId=null}={}){
  state.mode=mode==='demo'?'demo':'production'
  state.organizationId=organizationId||null
  state.demoAccountId=state.mode==='demo'?(demoAccountId||null):null
}

export const isDemoDataEnvironment=()=>state.mode==='demo'
export const dataEnvironment=()=>({...state})
export const dataPartitionKey=()=>{
  if(state.mode==='demo'){
    const account=normalizePartitionPart(state.demoAccountId,'owner-preview')
    return `demo.${account}`
  }
  return `org.${normalizePartitionPart(state.organizationId,'anonymous')}`
}

function emptyShape(value){
  if(Array.isArray(value))return []
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,emptyShape(item)]))
  return null
}

export const environmentFallback=fallback=>isDemoDataEnvironment()?structuredClone(fallback):emptyShape(fallback)
