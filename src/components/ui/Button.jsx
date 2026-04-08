import { cn } from '@/lib/utils'

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-dark active:bg-primary-dark shadow-sm',
  secondary: 'bg-bg-hover text-text border border-border hover:bg-border active:bg-border',
  success: 'bg-success text-white hover:opacity-90 active:opacity-80 shadow-sm',
  danger: 'bg-danger text-white hover:opacity-90 active:opacity-80 shadow-sm',
  warning: 'bg-warning text-white hover:opacity-90 active:opacity-80 shadow-sm',
  ghost: 'text-text-secondary hover:bg-bg-hover active:bg-border',
}

const sizes = {
  sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
  md: 'h-10 px-4 text-sm rounded-lg gap-2',
  lg: 'h-12 px-6 text-base rounded-lg gap-2',
  icon: 'h-10 w-10 rounded-lg',
  'icon-sm': 'h-8 w-8 rounded-md',
}

export function Button({ variant = 'primary', size = 'md', className, children, disabled, ...props }) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:opacity-50 disabled:pointer-events-none',
        'min-h-[44px] min-w-[44px]',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
