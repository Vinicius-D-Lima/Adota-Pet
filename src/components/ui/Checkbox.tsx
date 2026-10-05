import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, error, ...props },
  ref,
) {
  return (
    <label className="mt-2.5 flex cursor-pointer items-start gap-[11px] rounded-[11px] border border-line p-3.5">
      <input
        ref={ref}
        type="checkbox"
        aria-invalid={Boolean(error)}
        className="size-[17px] accent-forest-700"
        {...props}
      />
      <span className="flex flex-col">
        <strong className="text-xs">{label}</strong>
        {description && <small className="mt-[3px] text-[10px] text-muted">{description}</small>}
        {error && <small className="mt-[3px] text-[10px] text-[#a33f2d]">{error}</small>}
      </span>
    </label>
  )
})
