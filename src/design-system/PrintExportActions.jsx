import { Download, Printer } from 'lucide-react'
import { useLanguage } from '../core/i18n/LanguageContext'

export function PrintExportActions({showPrint=true,showExport=true,onPrint=()=>window.print(),onExport}){
  const {t}=useLanguage()
  return <div className="record-utility-actions">
    {showPrint&&<button type="button" className="entity-record-icon-button" title={t('print')} aria-label={t('print')} onClick={onPrint}><Printer size={16}/></button>}
    {showExport&&<button type="button" className="entity-record-icon-button" title={t('export')} aria-label={t('export')} onClick={onExport}><Download size={16}/></button>}
  </div>
}
