import { Info } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

/** Mensagem de erro de formulário/ação (anunciada por leitores de tela). */
export function Alert({ children, className, role = 'alert', ...props }: AlertProps) {
  return (
    <div
      className={cx(
        'mt-3.5 flex items-center gap-2 rounded-[9px] bg-[#fff0e9] px-[13px] py-[11px] text-[11px] text-[#a94b32]',
        className,
      )}
      role={role}
      {...props}
    >
      <Info size={17} /> {children}
    </div>
  )
}
