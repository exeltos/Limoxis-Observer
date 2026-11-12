// The window every clinical record dialog is built on (title, fields, Save / Cancel, validation).
import { Trash2 } from 'lucide-react'
import { Button } from '../../design-system/Button'
import { SaveButton } from '../../design-system/SaveButton'
import { FormSubmit } from '../../design-system/FormValidation'
import { ObserverDialog } from '../../design-system/ObserverDialog'
import type { AnyRecord } from '../../types/featureTypes'
import type { Handler } from './surveillanceTypes'
import type { ReactNode } from 'react'

interface SimpleDialogProps {
  title: string
  t: (key: string) => string
  onClose: Handler
  onSave: Handler
  children: ReactNode
  disabled?: boolean
  saveLabel?: string
  width?: string
  className?: string
  form?: AnyRecord | null
  danger?: boolean
}
export function SimpleDialog({
  title,
  t,
  onClose,
  onSave,
  children,
  disabled = false,
  saveLabel = '',
  width = 'standard',
  className = '',
  // A form from useFormValidation: the save says what is missing instead of saving empty.
  form = null,
  // A deletion: the button is red and names what it does.
  danger = false,
}: SimpleDialogProps) {
  return (
    <ObserverDialog
      title={title}
      width={width}
      className={`patient-simple-dialog ${className}`.trim()}
      onClose={onClose}
      footer={
        form ? (
          <FormSubmit form={form} disabled={disabled} onSubmit={onSave}>
            {saveLabel || t('save')}
          </FormSubmit>
        ) : danger ? (
          <Button variant="danger" disabled={disabled} onClick={onSave}>
            <Trash2 size={15} aria-hidden="true" />
            {saveLabel || t('delete')}
          </Button>
        ) : (
          <SaveButton disabled={disabled} onClick={onSave}>
            {saveLabel || t('save')}
          </SaveButton>
        )
      }
    >
      <div className="entry-grid">{children}</div>
    </ObserverDialog>
  )
}
