import { cn } from '@/lib/utils'

export function Spinner({ className, size = 'md' }) {
  const sizeClass = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  }[size]

  return (
    <svg
      className={cn('animate-spin text-primary', sizeClass, className)}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

export function LoadingScreen({ message = 'Đang tải...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Spinner size="lg" />
      <p className="text-text-secondary text-sm">{message}</p>
    </div>
  )
}

export function LoadingOverlay() {
  return (
    <div className="absolute inset-0 bg-bg/60 flex items-center justify-center z-10 rounded-lg">
      <Spinner size="md" />
    </div>
  )
}
