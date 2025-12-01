import type { ToastProps } from '../../types'

const iconPaths: Record<string, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 18L18 6M6 6l12 12',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
}

const bgColors: Record<string, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  warning: 'bg-yellow-500'
}

export default function Toast({ message, type, onClose }: ToastProps) {
  return (
    <div 
      className={`toast-enter ${bgColors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 cursor-pointer`}
      onClick={onClose}
      role="alert"
      aria-live="polite"
    >
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPaths[type]} />
      </svg>
      <span className="text-sm font-medium">{message}</span>
    </div>
  )
}