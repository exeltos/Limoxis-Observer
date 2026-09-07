import { ActionButton } from './ActionButton'
import { Button } from './Button'
import { ObserverDialog } from './ObserverDialog'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onClose,
  busy=false,
  tone='danger',
}){
  if(!open)return null
  return <ObserverDialog
    title={title}
    onClose={busy?undefined:onClose}
    width="compact"
    footer={<>
      <Button variant="secondary" disabled={busy} onClick={onClose}>{cancelLabel}</Button>
      <ActionButton tone={tone} loading={busy} disabled={busy} onClick={onConfirm}>{confirmLabel}</ActionButton>
    </>}
  >
    {description&&<p>{description}</p>}
  </ObserverDialog>
}
