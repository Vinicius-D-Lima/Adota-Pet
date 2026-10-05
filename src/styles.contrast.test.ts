import { describe, expect, it } from 'vitest'
import css from './styles.css?raw'

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

const contrast = (a: string, b: string) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** Lê `--token: #hex` do :root. */
const token = (name: string) => {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`token ${name} não encontrado`)
  return match[1]
}

const backgrounds = ['#ffffff', '#fbfaf6', '#fbf6eb', '#f3f6f3', '#f2f6f1', '#e6eee7', '#fbeae2']

describe('contraste WCAG AA (4,5:1) dos tokens de texto', () => {
  it.each(['--muted', '--ink', '--green-700', '--green-800', '--coral-dark'])(
    '%s sobre todos os fundos claros',
    (name) => {
      for (const background of backgrounds) {
        expect(
          contrast(token(name), background),
          `${name} sobre ${background}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    },
  )

  it('texto branco sobre o botão primário (e no hover)', () => {
    expect(contrast('#ffffff', token('--coral-dark'))).toBeGreaterThanOrEqual(4.5)
    expect(contrast('#ffffff', token('--coral-darker'))).toBeGreaterThanOrEqual(4.5)
  })
})

describe('movimento reduzido', () => {
  it('desliga animações e transições com prefers-reduced-motion', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(block).toContain('animation-duration: 0.01ms !important')
    expect(block).toContain('transition-duration: 0.01ms !important')
    expect(block).toContain('scroll-behavior: auto')
  })
})

describe('foco visível', () => {
  it('há uma regra global de :focus-visible com contorno', () => {
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid/)
  })
})
