import { FileSpreadsheet, FileText, FileType, Printer } from 'lucide-react'
import { Button } from './Button'
import { IconButton } from './IconButton'
import { OverflowMenu } from './OverflowMenu'
import { useOptionalLanguage } from '../core/i18n/LanguageContext'
import { createContext, useContext } from 'react'
import * as tenantModule from '../core/tenant/TenantContext'
import { canExportRawData } from '../core/permissions/systemRoleMatrix'

const ICONS = { print: Printer, pdf: FileText, excel: FileSpreadsheet, word: FileType }
const ORDER = ['print', 'pdf', 'excel', 'word', 'data']

// The one export control of the app, the same on list pages, record headers and
// dialogs: «Εξαγωγή ▾» with only the options that apply, in this order:
// Print, PDF, Excel, Word (then any further `items`, each with a `kind`).
// With a single option the button runs it directly, still labelled «Εξαγωγή».
// items: [{ id, kind: 'print' | 'pdf' | 'excel' | 'word' | 'data', label, onClick, disabled }]
// ('data' is the record's raw data file, listed last, and shown only to
// Platform Owner and Hospital Admin: everyone else never sees it.)
// compact: inside a table row, the same control as an icon button (tooltip «Εξαγωγή: …»).
// Outside the tenant provider (previews, isolated tests, a mocked tenant module)
// there is no role, so no raw data.
const NO_TENANT = createContext(null)
function tenantContext() {
  try {
    return tenantModule.TenantContext || NO_TENANT
  } catch {
    return NO_TENANT
  }
}

export function ExportMenu({
  onPrint,
  onPdf,
  onExcel,
  onWord,
  items = [],
  disabled = false,
  pdfBusy = false,
  language,
  className = '',
  compact = false,
  // A wider menu for long item names (one print per group of a list).
  menuWidth = 220,
  // The button's name when the menu is not «Εξαγωγή» (e.g. a menu that only prints).
  buttonLabel = '',
}) {
  const context = useOptionalLanguage()
  const rawData = canExportRawData(useContext(tenantContext())?.role)
  const en = (language || context?.language) === 'en'
  const label = buttonLabel || (en ? 'Export' : 'Εξαγωγή')
  const names = {
    print: en ? 'Print' : 'Εκτύπωση',
    pdf: 'PDF',
    excel: 'Excel',
    word: 'Word',
    data: 'JSON',
  }
  const base = [
    onPrint && { id: 'print', kind: 'print', onClick: onPrint },
    onPdf && { id: 'pdf', kind: 'pdf', onClick: onPdf, disabled: pdfBusy },
    onExcel && { id: 'excel', kind: 'excel', onClick: onExcel },
    onWord && { id: 'word', kind: 'word', onClick: onWord },
  ].filter(Boolean)
  const all = [...base, ...items.filter(item => item && (item.kind !== 'data' || rawData))]
    .map((item, index) => ({ ...item, index, kind: item.kind || 'excel' }))
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.index - b.index)
    .map(item => ({
      id: item.id || `${item.kind}-${item.index}`,
      label: item.label || names[item.kind],
      icon: ICONS[item.kind] || FileText,
      onClick: item.onClick,
      disabled: disabled || item.disabled,
    }))
  if (!all.length) return null
  if (compact && all.length === 1) {
    const only = all[0]
    return (
      <span className={`lo-export-menu lo-export-compact ${className}`.trim()} data-pdf-ignore="">
        <IconButton
          size="sm"
          label={`${label}: ${only.label}`}
          disabled={only.disabled}
          onClick={event => {
            event.stopPropagation()
            only.onClick?.()
          }}
        >
          <Printer size={15} />
        </IconButton>
      </span>
    )
  }
  if (compact)
    return (
      <span
        className={`lo-export-menu lo-export-compact ${className}`.trim()}
        data-pdf-ignore=""
        onClick={event => event.stopPropagation()}
      >
        <OverflowMenu
          label={label}
          width={220}
          trigger={<Printer size={15} aria-hidden="true" />}
          items={all}
        />
      </span>
    )
  if (all.length === 1) {
    const only = all[0]
    return (
      <span className={`lo-export-menu ${className}`.trim()} data-pdf-ignore="">
        <Button
          variant="secondary"
          className="lo-export-button"
          disabled={only.disabled}
          title={only.label}
          aria-label={`${label}: ${only.label}`}
          onClick={only.onClick}
        >
          <Printer size={15} aria-hidden="true" />
          {label}
        </Button>
      </span>
    )
  }
  return (
    <span className={`lo-export-menu ${className}`.trim()} data-pdf-ignore="">
      <OverflowMenu
        label={label}
        width={menuWidth}
        trigger={
          <>
            <Printer size={15} aria-hidden="true" />
            {label}
          </>
        }
        items={all}
      />
    </span>
  )
}
