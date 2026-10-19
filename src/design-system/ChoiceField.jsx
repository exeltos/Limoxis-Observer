import { SearchableSelect } from './SearchableSelect'

// A field with a choice of values (priority, status, type…): one house select,
// never a row of buttons. A yes / no flag is a CheckboxField instead.
export function ChoiceField({
  label,
  value,
  options = [],
  onChange,
  disabled = false,
  className = '',
  placeholder = '',
}) {
  return (
    <SearchableSelect
      className={className}
      label={label}
      value={value ?? ''}
      disabled={disabled}
      placeholder={placeholder}
      options={options.map(option => ({ value: option.value, label: option.label }))}
      onChange={next => next != null && onChange?.(next)}
    />
  )
}
