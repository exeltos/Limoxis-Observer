import 'react'

// Μεταβλητές CSS στο `style` (π.χ. `{ '--metric-count': 3 }`).
declare module 'react' {
  interface CSSProperties {
    [variable: `--${string}`]: string | number | undefined
  }
}
