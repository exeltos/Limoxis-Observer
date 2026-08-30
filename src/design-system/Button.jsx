export function Button({ variant = 'primary', className = '', type = 'button', loading = false, disabled, children, ...props }) {
  return (
    <button
      type={type}
      className={`button button-${variant} ${loading ? 'button-loading' : ''} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="button-spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}
