import { FileSpreadsheet, FileText } from 'lucide-react'
import { OverflowMenu } from './OverflowMenu'
import { useLanguage } from '../core/i18n/LanguageContext'

// The "…" menu with the available download formats.
export function DownloadMenu({ onExcel, onPdf, disabled = false, pdfBusy = false, extraItems = [] }) {
  const { language } = useLanguage()
  const en = language === 'en'
  return <span data-pdf-ignore=""><OverflowMenu label={en ? 'Download' : 'Λήψη'} items={[
    ...extraItems,
    onExcel && { id: 'excel', label: en ? 'Download Excel (.csv)' : 'Λήψη Excel (.csv)', icon: FileSpreadsheet, onClick: onExcel, disabled, separatorBefore: extraItems.length > 0 },
    onPdf && { id: 'pdf', label: en ? 'Download PDF' : 'Λήψη PDF', icon: FileText, onClick: onPdf, disabled: disabled || pdfBusy },
  ].filter(Boolean)} /></span>
}
