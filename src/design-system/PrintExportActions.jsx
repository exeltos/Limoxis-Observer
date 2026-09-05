import { Download, Printer } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useLanguage } from '../core/i18n/LanguageContext'

export function PrintExportActions({showPrint=true,showExport=true,onPrint=()=>window.print(),onExport}){
  const {t}=useLanguage()
  const location=useLocation()
  if(location.pathname.startsWith('/committees/'))return null
  return <div className="record-utility-actions">
    {showPrint&&<button type="button" className="entity-record-icon-button" title={t('print')} aria-label={t('print')} onClick={onPrint}><Printer size={16}/></button>}
    {showExport&&<button type="button" className="entity-record-icon-button" title={t('export')} aria-label={t('export')} onClick={onExport}><Download size={16}/></button>}
  </div>
}
