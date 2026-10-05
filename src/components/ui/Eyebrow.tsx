import type { ReactNode } from 'react'
import { cx } from './cx'

interface EyebrowProps {
  children: ReactNode
  /** Versão clara, para fundos escuros. */
  light?: boolean
  className?: string
}

/** Rótulo pequeno em caixa alta acima de um título. */
export function Eyebrow({ children, light = false, className }: EyebrowProps) {
  return (
    <span
      className={cx(
        'mb-4 inline-flex items-center gap-[7px] text-xs font-bold uppercase tracking-[0.12em]',
        light ? 'text-[#f4c5b4]' : 'text-coral-dark',
        className,
      )}
    >
      {children}
    </span>
  )
}
