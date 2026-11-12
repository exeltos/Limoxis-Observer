import { Save } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, type ButtonProps } from './Button'

export interface SaveButtonProps extends ButtonProps {
  // Shown in place of the text while `loading`.
  savingLabel?: ReactNode
}

export function SaveButton({ children, loading = false, savingLabel, className = '', ...props }: SaveButtonProps) {
  return (
    <Button variant="primary" loading={loading} className={className} {...props}>
      {!loading && <Save size={15} />}
      {loading && savingLabel ? savingLabel : children}
    </Button>
  )
}
