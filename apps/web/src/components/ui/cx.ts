import { twMerge } from 'tailwind-merge'

/** Junta nomes de classe ignorando valores vazios e resolvendo conflitos do Tailwind (vence o último). */
export const cx = (...names: Array<string | false | null | undefined>) =>
  twMerge(names.filter(Boolean).join(' '))
