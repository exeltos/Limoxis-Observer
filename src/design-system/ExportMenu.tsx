import { BarChart3, FileSpreadsheet, FileText, FileType, Printer } from 'lucide-react'
import { IconButton } from './IconButton'
import { OverflowMenu } from './OverflowMenu'
import { useOptionalLanguage } from '../core/i18n/LanguageContext'
import { createContext, useContext, type Context, type ReactNode } from 'react'
import * as tenantModule from '../core/tenant/TenantContext'
import { canExportRawData } from '../core/permissions/systemRoleMatrix'
import type { IconType } from './types'

const ICONS: Record<string, IconType> = { print: Printer, pdf: FileText, excel: FileSpreadsheet, word: FileType, report: BarChart3 }
const ORDER = ['print', 'pdf', 'excel', 'word', 'report', 'data']

// The one export control of the app, the same on list pages, record headers and
// dialogs: «Εξαγωγή ▾» with only the options that apply, in this order:
// Print, PDF, Excel, Word (then any further `items`, each with a `kind`).
// Always «Εξαγωγή ▾», even with a single option, so the control looks the same everywhere.
// items: [{ id, kind: 'print' | 'pdf' | 'excel' | 'word' | 'data', label, onClick, disabled }]
// ('data' is the record's raw data file, listed last, and shown only to
// Platform Owner and Hospital Admin: everyone else never sees it.)
// compact: inside a table row, the same control as an icon button (tooltip «Εξαγωγή: …»).
// Outside the tenant provider (previews, isolated tests, a mocked tenant module)
// there is no role, so no raw data.
// What this control reads from the tenant (TenantContext is not typed yet).
type TenantRole = { role?: string | null } | null
const NO_TENANT = createContext<TenantRole>(null)
function tenantContext(): Context<TenantRole> {
  try {
    return (tenantModule.TenantContext as Context<TenantRole>) || NO_TENANT
  } catch {
    return NO_TENANT
  }
}

export interface ExportItem {
  id?: string
  // 'print' | 'pdf' | 'excel' | 'word' | 'report' | 'data'
  kind?: string
  label?: ReactNode
  onClick?: () => void
  disabled?: boolean
}

interface ExportMenuProps {
  onPrint?: () => void
  onPdf?: () => void
  onExcel?: () => void
  onWord?: () => void
  items?: Array<ExportItem | null | false | undefined>
  disabled?: boolean
  pdfBusy?: boolean
  language?: string
  className?: string
  compact?: boolean
  menuWidth?: number
  buttonLabel?: string
  // The page prints a document of its own: EntityRecordShell keeps this onPrint.
  ownPrint?: boolean
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
}: ExportMenuProps) {
  const context = useOptionalLanguage()
  const rawData = canExportRawData(useContext(tenantContext())?.role)
  const en = (language || context?.language) === 'en'
  const label = buttonLabel || (en ? 'Export' : 'Εξαγωγή')
  const names: Record<string, string> = {
    print: en ? 'Print' : 'Εκτύπωση',
    pdf: 'PDF',
    excel: 'Excel',
    word: 'Word',
    data: 'JSON',
  }
  const base: ExportItem[] = [
    onPrint && { id: 'print', kind: 'print', onClick: onPrint },
    onPdf && { id: 'pdf', kind: 'pdf', onClick: onPdf, disabled: pdfBusy },
    onExcel && { id: 'excel', kind: 'excel', onClick: onExcel },
    onWord && { id: 'word', kind: 'word', onClick: onWord },
  ].filter(Boolean)
  const all = [...base, ...items.filter((item): item is ExportItem => !!item && (item.kind !== 'data' || rawData))]
    .map((item, index) => ({ ...item, index, kind: item.kind || 'excel' }))
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.index - b.index)
    .map(item => ({
      id: item.id || `${item.kind}-${item.index}`,
      label: item.label || names[item.kind as string],
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
