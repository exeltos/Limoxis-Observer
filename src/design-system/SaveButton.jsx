import { Save } from 'lucide-react'
import { Button } from './Button'

export function SaveButton({ children, loading = false, savingLabel, className = '', ...props }) {
  return (
    <Button variant="primary" loading={loading} className={className} {...props}>
      {!loading && <Save size={15} />}
      {loading && savingLabel ? savingLabel : children}
    </Button>
  )
}
