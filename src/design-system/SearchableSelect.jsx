import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { FieldLabelText, FieldMessage } from './FormValidation'
import './SearchableSelect.css'

const normalize = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// A select the user can type into: the options narrow to those whose label,
// description or keywords contain the text (accents and case ignored). Follows the
// WAI-ARIA combobox pattern: Arrow keys move through the list, Enter picks,
// Escape closes and restores the current choice.
// options: [{ value, label, description?, keywords? }]
export function SearchableSelect({
  label,
  value,
  options = [],
  onChange,
  placeholder = '',
  emptyLabel = '',
  clearLabel = '',
  className = '',
  recentValues = [],
  recentLabel = '',
  allowCustom = false,
  customLabel = text => `«${text}»`,
  hideLabel = false,
  disabled = false,
  required = false,
  error = '',
  hint = '',
  fieldKey,
}) {
  const baseId = useId().replace(/:/g, '')
  const inputId = `${baseId}-input`,
    listId = `${baseId}-list`
  const selected =
    options.find(option => String(option.value) === String(value)) ||
    (allowCustom && String(value ?? '').trim() ? { value, label: String(value) } : null)
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(null),
    [activeIndex, setActiveIndex] = useState(-1)
  const listRef = useRef(null),
    controlRef = useRef(null)
  const [place, setPlace] = useState(null)
  const text = query ?? selected?.label ?? ''
  const matches = useMemo(() => {
    const needle = normalize(query)
    if (!needle) {
      const recent = recentValues
        .map(item => options.find(option => String(option.value) === String(item)))
        .filter(Boolean)
        .slice(0, 5)
      if (!recent.length) return options
      const recentSet = new Set(recent.map(option => String(option.value)))
      return [
        ...recent.map((option, index) => ({ ...option, group: index === 0 ? recentLabel : '' })),
        ...options
          .filter(option => !recentSet.has(String(option.value)))
          .map((option, index) => ({ ...option, divider: index === 0 })),
      ]
    }
    const found = options.filter(option =>
      normalize(
        `${option.label} ${option.description || ''} ${option.keywords || ''} ${option.value}`,
      ).includes(needle),
    )
    const typed = String(query).trim()
    if (allowCustom && typed && !options.some(option => normalize(option.label) === needle))
      // Enter keeps the first library match; the typed text comes last.
      return [...found, { value: typed, label: customLabel(typed), custom: true, divider: found.length > 0 }]
    return found
  }, [options, query, recentValues, recentLabel, allowCustom, customLabel])
  const optionId = index => `${baseId}-option-${index}`

  // The list floats over the page (fixed) like MultiSelect's, so a scrolling
  // table or dialog never clips it; it opens upwards when there is no room
  // below and follows the field when something scrolls.
  useEffect(() => {
    if (!open) return undefined
    function measure() {
      const rect = controlRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.max(rect.width, 240)
      const below = window.innerHeight - rect.bottom
      const upward = below < 280 && rect.top > below
      const alignEnd = rect.left + width > window.innerWidth - 16
      setPlace({
        width,
        maxHeight: Math.min(260, (upward ? rect.top : below) - 12),
        ...(upward ? { top: 'auto', bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4, bottom: 'auto' }),
        ...(alignEnd ? { left: 'auto', right: window.innerWidth - rect.right } : { left: rect.left, right: 'auto' }),
      })
    }
    measure()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open])

  function close() {
    setOpen(false)
    setQuery(null)
    setActiveIndex(-1)
  }
  function choose(option) {
    onChange?.(option.value)
    close()
  }
  function move(step) {
    if (!matches.length) return
    const next = open ? (activeIndex + step + matches.length) % matches.length : 0
    setOpen(true)
    setActiveIndex(next)
    listRef.current?.querySelector(`#${optionId(next)}`)?.scrollIntoView?.({ block: 'nearest' })
  }
  function onKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(-1)
    } else if (event.key === 'Enter') {
      if (open && matches[activeIndex]) {
        event.preventDefault()
        choose(matches[activeIndex])
      }
    } else if (event.key === 'Escape') {
      if (open || query !== null) {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }
  }

  return (
    <div
      className={`searchable-select ${className}`.trim()}
      data-field-key={fieldKey}
      data-invalid={error ? 'true' : undefined}
    >
      {!hideLabel && (
        <label htmlFor={inputId}>
          <span className="lo-field-label">
            <FieldLabelText label={label} required={required} />
          </span>
        </label>
      )}
      <div className="searchable-select-control" ref={controlRef}>
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-label={hideLabel ? label : undefined}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          disabled={disabled}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
          value={text}
          placeholder={placeholder}
          onChange={event => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(event.target.value ? 0 : -1)
          }}
          // A form pointing at a missing field focuses it quietly (data-quiet-focus):
          // the list stays closed so the field's message stays in view.
          onFocus={event => {
            if (!event.target.dataset.quietFocus) setOpen(true)
          }}
          onClick={() => setOpen(true)}
          onBlur={() => {
            // A typed name is kept on leaving the field: the library entry it
            // spells, or the text itself where custom values are allowed.
            const typed = String(query ?? '').trim()
            if (allowCustom && typed && typed !== String(value ?? '')) {
              const exact = options.find(option => normalize(option.label) === normalize(typed))
              onChange?.(exact ? exact.value : typed)
            } else if (allowCustom && query !== null && !typed && String(value ?? '') !== '') {
              // Text erased and the field left: the value is cleared.
              onChange?.('')
            }
            close()
          }}
          onKeyDown={onKeyDown}
        />
        {selected && clearLabel ? (
          <button
            type="button"
            className="searchable-select-clear"
            aria-label={clearLabel}
            title={clearLabel}
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              onChange?.('')
              close()
            }}
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : (
          <ChevronDown className="searchable-select-chevron" size={15} aria-hidden="true" />
        )}
      </div>
      <ul
        id={listId}
        ref={listRef}
        role="listbox"
        aria-label={label}
        className="searchable-select-list"
        hidden={!open}
        style={place ? { position: 'fixed', zIndex: 1200, margin: 0, ...place } : undefined}
      >
        {matches.map((option, index) => [
          option.group ? (
            <li key={`group-${option.value}`} className="searchable-select-group" role="presentation">
              {option.group}
            </li>
          ) : null,
          <li
            key={`${option.custom ? 'custom-' : ''}${option.value}`}
            id={optionId(index)}
            role="option"
            aria-selected={String(option.value) === String(value)}
            className={`searchable-select-option${index === activeIndex ? ' active' : ''}${option.divider ? ' divider' : ''}${option.custom ? ' custom' : ''}`}
            onMouseDown={event => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => choose(option)}
          >
            <span className="searchable-select-option-label">{option.label}</span>
            {option.description && (
              <small className="searchable-select-option-description">{option.description}</small>
            )}
          </li>,
        ])}
        {!matches.length && emptyLabel && (
          <li className="searchable-select-empty" role="presentation">
            {emptyLabel}
          </li>
        )}
      </ul>
      <FieldMessage error={error} hint={hint} />
    </div>
  )
}
