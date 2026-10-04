import { useFavoriteNotice } from '../hooks/useFavoriteNotice'

/** Região viva: o leitor de tela anuncia o aviso quando o texto muda. */
export function FavoriteNotice() {
  const message = useFavoriteNotice()

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {message && <p className="toast">{message}</p>}
    </div>
  )
}
