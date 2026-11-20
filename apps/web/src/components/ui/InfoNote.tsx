import { Info } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { cx } from './cx'

interface InfoNoteProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Texto maior, para avisos que precisam ser lidos com atenção. */
  large?: boolean
}

/** Nota informativa discreta, com ícone. Links e `strong` dentro dela ganham destaque. */
export function InfoNote({ children, large = false, className, ...props }: InfoNoteProps) {
  return (
    <div
      className={cx(
        'flex items-start gap-2.5 rounded-xl bg-[#f3f6f3] px-4 py-3.5 text-forest-700',
        className,
      )}
      {...props}
    >
      <Info size={18} className="mt-0.5 shrink-0" />
      <div
        className={cx(
          'leading-[1.55] text-muted [&_a]:font-bold [&_a]:underline [&_strong]:text-forest-800',
          large ? 'text-sm' : 'text-[11px]',
        )}
      >
        {children}
      </div>
    </div>
  )
}
