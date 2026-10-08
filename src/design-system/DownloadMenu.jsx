import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import { OverflowMenu } from './OverflowMenu'
import { useLanguage } from '../core/i18n/LanguageContext'

// One "Download" button that opens the available formats.
export function DownloadMenu({ onExcel, onPdf, disabled = false, pdfBusy = false }) {
  const { language } = useLanguage()
  const en = language === 'en'
  const label = en ? 'Download' : 'Λήψη'
  return <span data-pdf-ignore=""><OverflowMenu label={label} trigger={<><Download size={15} aria-hidden="true" />{label}</>} items={[
    onExcel && { id: 'excel', label: en ? 'Excel (.csv)' : 'Excel (.csv)', icon: FileSpreadsheet, onClick: onExcel, disabled },
    onPdf && { id: 'pdf', label: 'PDF', icon: FileText, onClick: onPdf, disabled: disabled || pdfBusy },
  ].filter(Boolean)} /></span>
}
