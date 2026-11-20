import { cx } from './cx'

export type ButtonVariant = 'primary' | 'secondary' | 'cream' | 'danger' | 'text' | 'text-danger'
export type ButtonSize = 'md' | 'sm'

export interface ButtonStyleProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

const base =
  'inline-flex min-h-12 cursor-pointer items-center justify-center gap-[9px] rounded-xl border border-transparent px-5 text-sm font-bold transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-65 disabled:hover:translate-y-0 aria-busy:cursor-progress'

const textButton =
  'min-h-0 gap-1 rounded-none border-0 bg-transparent p-0 text-xs shadow-none hover:translate-y-0'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-coral text-white shadow-[0_10px_22px_rgba(210,95,59,0.22)] hover:bg-coral-dark',
  secondary: 'border-line bg-white text-forest-800',
  cream: 'bg-[#fffaf0] text-forest-900',
  danger: 'bg-[#a55039] text-white hover:bg-[#8c4130]',
  text: `${textButton} text-coral-dark`,
  'text-danger': `${textButton} text-[#a55039]`,
}

/** Classes de um botão; útil para elementos que não podem ser `Button` (por exemplo um `<a>` comum). */
export const buttonClass = ({ variant = 'primary', size = 'md', fullWidth }: ButtonStyleProps) =>
  cx(
    base,
    variants[variant],
    size === 'sm' && !variant.startsWith('text') && 'min-h-[38px] px-3.5 text-xs',
    fullWidth && 'w-full',
  )
