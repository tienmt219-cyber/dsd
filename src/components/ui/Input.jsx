import { cn } from '@/lib/utils'
import { forwardRef } from 'react'

export const Input = forwardRef(function Input({ className, label, error, ...props }, ref) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full h-10 px-3 text-sm rounded-lg border transition-colors duration-150',
          'bg-bg-input text-text placeholder:text-text-muted',
          'border-border focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary/20',
          error && 'border-danger focus:border-danger focus:ring-danger/20',
          className
        )}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  )
})

export const Select = forwardRef(function Select({ className, label, children, ...props }, ref) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-text-secondary mb-1">
          {label}
        </label>
      )}
      <select
        ref={ref}
        className={cn(
          'w-full h-10 px-3 text-sm rounded-lg border transition-colors duration-150',
          'bg-bg-input text-text',
          'border-border focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-primary/20',
          className
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  )
})
