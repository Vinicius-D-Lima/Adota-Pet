/** Junta nomes de classe ignorando valores vazios. */
export const cx = (...names: Array<string | false | null | undefined>) =>
  names.filter(Boolean).join(' ')
