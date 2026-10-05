import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'cream' | 'danger' | 'text' | 'text-danger'
export type ButtonSize = 'md' | 'sm'

interface ButtonStyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const buttonClass = ({ variant = 'primary', size = 'md', fullWidth }: ButtonStyleProps) =>
  cx('button', variant, size === 'sm' && 'sm', fullWidth && 'full')

interface ButtonProps extends ButtonStyleProps, ButtonHTMLAttributes<HTMLButtonElement> {
  /** Desabilita o botão e mostra um spinner antes do conteúdo. */
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant,
  size,
  fullWidth,
  loading = false,
  disabled,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(buttonClass({ variant, size, fullWidth }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}

interface LinkButtonProps extends ButtonStyleProps, LinkProps {}

/** Link de navegação com a aparência de um Button. */
export function LinkButton({ variant, size, fullWidth, className, ...props }: LinkButtonProps) {
  return <Link className={cx(buttonClass({ variant, size, fullWidth }), className)} {...props} />
}
