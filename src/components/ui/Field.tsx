import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cx } from './cx'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  /** Ocupa a linha inteira quando o Field está dentro de uma grade. */
  full?: boolean
  /** Sem margem abaixo da dica/erro (use quando a grade já tem espaçamento). */
  tight?: boolean
}

/** Rótulo + controle + mensagem de erro/ajuda. Envolva `Input`, `Select` ou `Textarea`. */
export function Field({ label, hint, error, children, full = false, tight = false }: FieldProps) {
  const margin = tight ? '' : 'mb-[18px]'
  return (
    <label className={cx('flex min-w-0 flex-col gap-[7px]', full && 'col-span-full')}>
      <span className="text-xs font-bold">{label}</span>
      {children}
      {error ? (
        <small className={cx('text-left text-[9px] text-[#a33f2d]', margin)}>{error}</small>
      ) : (
        hint && <small className={cx('text-right text-[9px] text-[#8b9791]', margin)}>{hint}</small>
      )}
    </label>
  )
}

const controlClass =
  'w-full min-w-0 max-w-full rounded-[10px] border border-line bg-[#fdfdfb] p-3 leading-[1.4] text-ink outline-none focus:border-forest-700 focus:ring-[3px] focus:ring-forest-700/10 aria-invalid:border-[#c4543d] aria-invalid:ring-[3px] aria-invalid:ring-[#c4543d]/15'

/** `invalid` marca o controle com `aria-invalid` (estado de erro). */
interface InvalidProp {
  invalid?: boolean
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & InvalidProp
>(function Input({ invalid, className, ...props }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid ?? props['aria-invalid']}
      className={cx(controlClass, className)}
      {...props}
    />
  )
})

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & InvalidProp
>(function Select({ invalid, className, ...props }, ref) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid ?? props['aria-invalid']}
      className={cx(controlClass, 'pr-[38px]', className)}
      {...props}
    />
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & InvalidProp
>(function Textarea({ invalid, className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid ?? props['aria-invalid']}
      className={cx(controlClass, 'resize-y', className)}
      {...props}
    />
  )
})
