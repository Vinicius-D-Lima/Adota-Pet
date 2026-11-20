import { useFavoriteNotice } from '../hooks/useFavoriteNotice'

/** Região viva: o leitor de tela anuncia o aviso quando o texto muda. */
export function FavoriteNotice() {
  const message = useFavoriteNotice()

  return (
    <div
      className="fixed bottom-4 right-4 z-50 max-w-[min(360px,calc(100vw-32px))]"
      role="status"
      aria-live="polite"
    >
      {message && (
        <p className="mb-0 rounded-[10px] bg-forest-900 px-[15px] py-3 text-xs font-semibold text-white shadow-soft">
          {message}
        </p>
      )}
    </div>
  )
}
