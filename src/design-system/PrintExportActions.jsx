import { Download, Printer } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../core/i18n/LanguageContext'

// A record's print / download utilities, as icon buttons beside the status
// (EntityRecordShell keeps them visible; edit and delete go to the «…» menu).
// `exportLabel` names what the download gives (e.g. «Λήψη Word»).
export function PrintExportActions({showPrint=true,showExport=true,onPrint=()=>window.print(),onExport,printLabel,exportLabel}){
  const {t}=useLanguage()
  const location=useLocation()
  if(location.pathname.startsWith('/committees/'))return null
  const print=printLabel||t('print'),download=exportLabel||t('export')
  return <div className="record-utility-actions">
    {showPrint&&<button type="button" className="entity-record-icon-button" title={print} aria-label={print} onClick={onPrint}><Printer size={16}/></button>}
    {showExport&&onExport&&<button type="button" className="entity-record-icon-button" title={download} aria-label={download} onClick={onExport}><Download size={16}/></button>}
  </div>
}
