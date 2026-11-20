import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { buttonClass, type ButtonStyleProps } from './buttonClass'
import { cx } from './cx'

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
      {loading && (
        <span
          className="inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}

interface LinkButtonProps extends ButtonStyleProps, LinkProps {}

/** Link de navegação com a aparência de um Button. */
export function LinkButton({ variant, size, fullWidth, className, ...props }: LinkButtonProps) {
  return <Link className={cx(buttonClass({ variant, size, fullWidth }), className)} {...props} />
}
