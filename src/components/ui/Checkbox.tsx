import type { InputHTMLAttributes, ReactNode } from 'react'

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'> {
  label: ReactNode
  description?: ReactNode
  error?: ReactNode
}

export function Checkbox({ label, description, error, ...props }: CheckboxProps) {
  return (
    <label className="check-field">
      <input type="checkbox" aria-invalid={Boolean(error)} {...props} />
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
        {error && <small className="check-error">{error}</small>}
      </span>
    </label>
  )
}
