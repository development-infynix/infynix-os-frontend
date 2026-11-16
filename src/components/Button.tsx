import { Loader2 } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Shows a spinner and blocks clicks while an action runs. */
  loading?: boolean
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-label',
  md: 'h-9 px-3.5 text-body',
  lg: 'h-10 px-4 text-body',
}

/**
 * The app's button: lit from above (see `.btn` in index.css), in primary,
 * secondary and danger, light and dark.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, disabled, className = '', children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn-${variant} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={15} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
})
