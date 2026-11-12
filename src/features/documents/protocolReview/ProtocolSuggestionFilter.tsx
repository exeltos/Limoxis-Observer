import { useMemo } from 'react'
import { FilterSelect } from '../../../design-system/FilterBar'
import { StatusBadge } from '../../../design-system/StatusBadge'
import { useTenant } from '../../../core/tenant/TenantContext'
import { useProtocolSuggestions } from './useProtocolSuggestions'
import { documentsWithOpenSuggestions } from './protocolReviewModel'

// The documents registry: which protocols have open update suggestions.
export function useOpenSuggestionKeys(){
 const {tenant}=useTenant()
 const {data}=useProtocolSuggestions(tenant?.id||null)
 return useMemo(()=>documentsWithOpenSuggestions(data),[data])
}

export function ProtocolSuggestionFilter({value,onChange,language='el'}){
 const en=language==='en'
 return <FilterSelect label={en?'Update suggestions':'Προτάσεις ανανέωσης'} value={value} onChange={onChange}>
  <option value="all">{en?'All':'Όλα'}</option>
  <option value="open">{en?'With open suggestions':'Με ανοιχτές προτάσεις'}</option>
 </FilterSelect>
}

export function ProtocolSuggestionMarker({language='el'}){
 return <StatusBadge tone="warning" className="protocol-suggestion-marker">{language==='en'?'Update suggested':'Προτείνεται ανανέωση'}</StatusBadge>
}
