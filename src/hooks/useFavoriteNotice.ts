import { useSyncExternalStore } from 'react'

const NOTICE_DURATION_MS = 5000

let message = ''
let timer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((listener) => listener())

export function clearFavoriteNotice() {
  clearTimeout(timer)
  message = ''
  emit()
}

export function showFavoriteNotice(text: string) {
  clearTimeout(timer)
  message = text
  timer = setTimeout(clearFavoriteNotice, NOTICE_DURATION_MS)
  emit()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useFavoriteNotice() {
  return useSyncExternalStore(
    subscribe,
    () => message,
    () => '',
  )
}
