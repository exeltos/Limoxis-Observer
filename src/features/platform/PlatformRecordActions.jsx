import { Button } from '../../design-system/Button'
import { OverflowMenu } from '../../design-system/OverflowMenu'

// The actions of an organization or Demo record: the main one as a labelled
// primary button, everyday ones as labelled secondary buttons, the rest (resets,
// conversions, deletion) in a "More" menu with the destructive one last.
// Each action: { id, icon, label, title, onClick, disabled, placement: 'primary'|'secondary'|'menu', danger }.
export function PlatformRecordActions({ actions = [], label, moreLabel }) {
  const shown = actions.filter(Boolean)
  const buttons = shown.filter(action => action.placement !== 'menu')
  const menu = shown.filter(action => action.placement === 'menu')
  const firstDanger = menu.findIndex(action => action.danger)
  return (
    <div className="platform-record-actions" role="group" aria-label={label}>
      {buttons.map(action => (
        <Button
          key={action.id}
          variant={action.placement === 'primary' ? 'primary' : 'secondary'}
          title={action.title}
          aria-label={action.title || action.label}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          {action.icon}
          <span>{action.label}</span>
        </Button>
      ))}
      {menu.length > 0 && (
        <OverflowMenu
          label={moreLabel}
          size="md"
          items={menu.map((action, index) => ({
            id: action.id,
            label: action.title || action.label,
            icon: action.icon?.type,
            onClick: action.onClick,
            disabled: action.disabled,
            tone: action.danger ? 'danger' : undefined,
            separatorBefore: index > 0 && index === firstDanger,
          }))}
        />
      )}
    </div>
  )
}
