import { Info } from 'lucide-react'
import type { ReactNode } from 'react'

interface AlertProps {
  children: ReactNode
}

/** Mensagem de erro de formulário/ação (anunciada por leitores de tela). */
export function Alert({ children }: AlertProps) {
  return (
    <div className="form-error" role="alert">
      <Info size={17} /> {children}
    </div>
  )
}
