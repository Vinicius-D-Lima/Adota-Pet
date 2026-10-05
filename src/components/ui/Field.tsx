import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

interface FieldProps {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  children: ReactNode
  full?: boolean
}

/** Rótulo + controle + mensagem de erro/ajuda. Envolva `Input`, `Select` ou `Textarea`. */
export function Field({ label, hint, error, children, full = false }: FieldProps) {
  return (
    <label className={full ? 'field full' : 'field'}>
      <span>{label}</span>
      {children}
      {error ? <small className="field-error">{error}</small> : hint && <small>{hint}</small>}
    </label>
  )
}

/** `invalid` marca o controle com `aria-invalid` (estado de erro). */
interface InvalidProp {
  invalid?: boolean
}

export function Input({ invalid, ...props }: InputHTMLAttributes<HTMLInputElement> & InvalidProp) {
  return <input aria-invalid={invalid || props['aria-invalid']} {...props} />
}

export function Select({
  invalid,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & InvalidProp) {
  return <select aria-invalid={invalid || props['aria-invalid']} {...props} />
}

export function Textarea({
  invalid,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & InvalidProp) {
  return <textarea aria-invalid={invalid || props['aria-invalid']} {...props} />
}
