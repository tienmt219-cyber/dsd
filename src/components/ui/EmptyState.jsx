import { cn } from '@/lib/utils'

export function EmptyState({ icon: Icon, title, description, children, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {Icon && <Icon className="w-12 h-12 text-text-muted mb-4" />}
      <h3 className="text-lg font-semibold text-text mb-1">{title}</h3>
      {description && <p className="text-sm text-text-secondary max-w-sm">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}
