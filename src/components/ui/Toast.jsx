import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

const typeStyles = {
  success: { icon: CheckCircle, bg: 'bg-success', color: 'text-white' },
  error: { icon: XCircle, bg: 'bg-danger', color: 'text-white' },
  warning: { icon: AlertTriangle, bg: 'bg-warning', color: 'text-white' },
  info: { icon: Info, bg: 'bg-primary', color: 'text-white' },
}

export function ToastContainer({ toasts, removeToast }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => {
        const style = typeStyles[toast.type] || typeStyles.success
        const Icon = style.icon
        return (
          <div
            key={toast.id}
            className={cn(
              'toast-enter flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
              style.bg, style.color
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="shrink-0 hover:opacity-80">
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
