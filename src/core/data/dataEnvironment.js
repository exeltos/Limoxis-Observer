const state={mode:'production',organizationId:null}

export function configureDataEnvironment({mode='production',organizationId=null}={}){
  state.mode=mode==='demo'?'demo':'production'
  state.organizationId=organizationId||null
}

export const isDemoDataEnvironment=()=>state.mode==='demo'
export const dataPartitionKey=()=>state.mode==='demo'?`demo.${state.organizationId||'default'}`:`org.${state.organizationId||'anonymous'}`

function emptyShape(value){
  if(Array.isArray(value))return []
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,emptyShape(item)]))
  return null
}

export const environmentFallback=fallback=>isDemoDataEnvironment()?structuredClone(fallback):emptyShape(fallback)
