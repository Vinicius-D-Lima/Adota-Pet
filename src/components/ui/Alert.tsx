import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

interface AlertProps {
  children: ReactNode
}

/** Mensagem de erro de formulário/ação (anunciada por leitores de tela). */
export function Alert({ children }: AlertProps) {
  return (
    <div
      className="mt-3.5 flex items-center gap-2 rounded-[9px] bg-[#fff0e9] px-[13px] py-[11px] text-[11px] text-[#a94b32]"
      role="alert"
    >
      <Info size={17} /> {children}
    </div>
  )
}
