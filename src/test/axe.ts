import axe from 'axe-core'

/**
 * Violações críticas ou sérias do axe. O jsdom não calcula layout, então `color-contrast` fica de
 * fora aqui: o contraste é conferido por `styles.contrast.test.ts` e no navegador.
 */
export async function seriousViolations(container: Element) {
  const { violations } = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false } },
  })
  return violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      nodes: violation.nodes.map((node) => node.target.join(' ')),
    }))
}
