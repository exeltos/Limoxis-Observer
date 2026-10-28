import { useMemo,useState } from 'react'
import { FigureCards } from '../../design-system/FigureCards'
import { Truck } from 'lucide-react'
import { Page } from '../../design-system/Page'
import { FilterBar } from '../../design-system/FilterBar'
import { StatusBadge } from '../../design-system/StatusBadge'
import { RegistryEmptyState } from '../../design-system/RegistryEmptyState'
import { TableSkeleton } from '../../design-system/LoadingSkeleton'
import { useLanguage } from '../../core/i18n/LanguageContext'
import { formatDay } from '../../core/i18n/formatDay'
import { useResources } from '../quality/resources/ResourcesPanel'
import { approvalLabel,approvalTone,certificationStateLabel,certificationStateTone,supplierCategoryLabel } from '../quality/resources/resourceModel'
import { formatPercent } from '../quality/resources/supplierTemplates'

// /my-department/suppliers — the suppliers the Quality team assigned to the department, read only:
// how each was last evaluated, when the next evaluation is due, and its certificates and when they expire.
export function DepartmentSuppliersPage(){
 const {language}=useLanguage(),en=language==='en'
 const list=useResources(true)
 const [query,setQuery]=useState('')
 const rows=useMemo(()=>list.suppliers.filter(item=>item.status!=='inactive').filter(item=>`${item.name} ${item.legalName||''}`.toLowerCase().includes(query.trim().toLowerCase())),[list.suppliers,query])
 const attention=rows.filter(row=>row.approval==='conditional'||row.approval==='rejected').length
 const dueNow=rows.filter(row=>row.evaluationDue).length
 const expiring=rows.filter(row=>row.expiredCertificates||row.expiringCertificates).length
 return <Page fill title={en?'Department suppliers':'Προμηθευτές τμήματος'} subtitle={en?'The suppliers assigned to your department, with their evaluations and certificates.':'Οι προμηθευτές που έχουν ανατεθεί στο τμήμα σας, με τις αξιολογήσεις και τα πιστοποιητικά τους.'}>
  <FigureCards className="quality-summary-line"><span><b>{list.loading?'—':rows.length}</b> {en?'suppliers':'προμηθευτές'}</span><span className={attention?'is-late':undefined}><b>{list.loading?'—':attention}</b> {en?'need attention':'χρειάζονται προσοχή'}</span><span><b>{list.loading?'—':dueNow}</b> {en?'evaluation due':'προς αξιολόγηση'}</span><span className={expiring?'is-late':undefined}><b>{list.loading?'—':expiring}</b> {en?'with certificates expiring':'με πιστοποιητικά που λήγουν'}</span></FigureCards>
  <section className="surface registry-workspace workspace-column workspace-fill">
   <FilterBar query={query} onQueryChange={setQuery} placeholder={en?'Search supplier…':'Αναζήτηση προμηθευτή…'}/>
   {list.loading?<TableSkeleton/>:<div className="scroll-table"><table className="data-table sticky-table"><thead><tr><th>{en?'Supplier':'Προμηθευτής'}</th><th>{en?'Last evaluation':'Τελευταία αξιολόγηση'}</th><th>{en?'Next evaluation':'Επόμενη αξιολόγηση'}</th><th>{en?'Certificates':'Πιστοποιητικά'}</th></tr></thead><tbody>
    {rows.map(row=>{const certs=(row.certifications||[]).filter(item=>item.expiresOn).sort((a,b)=>String(a.expiresOn).localeCompare(String(b.expiresOn)))[0]
     return <tr key={row.id}>
      <td><strong>{row.name}</strong><small>{supplierCategoryLabel(row.category,language)}</small></td>
      <td>{row.latestEvaluation?<><StatusBadge tone={approvalTone(row.approval)}>{approvalLabel(row.approval,language)}{row.score!=null?` · ${formatPercent(row.score,language)}`:''}</StatusBadge><small>{formatDay(row.latestEvaluation.evaluatedOn,language)}{row.latestEvaluation.templateName?` · ${row.latestEvaluation.templateName}`:''}</small></>:<StatusBadge tone={approvalTone('unevaluated')}>{approvalLabel('unevaluated',language)}</StatusBadge>}</td>
      <td>{row.nextEvaluation?formatDay(row.nextEvaluation,language):'—'}{row.evaluationDue&&<small className="quality-overdue-text">{en?'due':'προς αξιολόγηση'}</small>}</td>
      <td>{(row.certifications||[]).length}{row.expiredCertificates>0&&<> · <StatusBadge tone={certificationStateTone('expired')}>{row.expiredCertificates} {certificationStateLabel('expired',language).toLowerCase()}</StatusBadge></>}{row.expiringCertificates>0&&<> · <StatusBadge tone={certificationStateTone('expiring')}>{row.expiringCertificates} {certificationStateLabel('expiring',language).toLowerCase()}</StatusBadge></>}{certs&&<small>{en?'Next expiry':'Πρώτη λήξη'}: {formatDay(certs.expiresOn,language)}</small>}</td>
     </tr>})}
   </tbody></table>{!rows.length&&<RegistryEmptyState icon={Truck} title={en?'No suppliers assigned to the department':'Δεν έχουν ανατεθεί προμηθευτές στο τμήμα'} text={en?'The Quality team assigns the suppliers each department uses.':'Η Ποιότητα ορίζει ποιους προμηθευτές χρησιμοποιεί κάθε τμήμα.'}/>}</div>}
  </section>
 </Page>
}
