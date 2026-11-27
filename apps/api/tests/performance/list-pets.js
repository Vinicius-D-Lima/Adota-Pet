/**
 * Carga na API de listagem de pets (issue #128), sem Docker e sem dependência npm.
 *
 * Execução manual, com a API já rodando:
 *   BASE_URL=http://localhost:3000 k6 run apps/api/tests/performance/list-pets.js
 *
 * `BASE_URL` pode ser sobrescrito por __ENV; o padrão é http://localhost:3000.
 * Os quatro cenários são escalonados por startTime para não somar 11.101 VUs
 * ao mesmo tempo na mesma máquina. O de 10.000 VUs é diagnóstico: meça a
 * capacidade do host antes de usar a carga máxima.
 *
 * Este módulo é importável por Node/Vitest: nenhuma global do k6 é lida no
 * topo. `http` e `check` são usados apenas dentro de `default`, via globalThis,
 * e a função de requisição os recebe como parâmetros.
 */

const env = globalThis.__ENV || {}
export const BASE_URL = String(env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '')

export const ENDPOINTS = {
  recent: '/api/pets?sort=recent&limit=12&page=1',
  filters:
    '/api/pets?sort=recent&limit=12&page=1&species=Cachorro&size=M%C3%A9dio&sex=F%C3%AAmea&city=S%C3%A3o%20Paulo',
  distance: '/api/pets?sort=distance&limit=12&page=1&lat=-23.5505&lng=-46.6333',
}

/** Uma rota por iteração cobre listagem recent, filtros e ordenação por distância. */
export const REQUEST_PATHS = [ENDPOINTS.recent, ENDPOINTS.filters, ENDPOINTS.distance]

export const CHECKS = {
  status: 'status 200',
  no5xx: 'sem 5xx',
}

/** Orçamento de p95 em ms por cenário; `null` marca o cenário só de diagnóstico. */
export const LATENCY_BUDGETS_MS = {
  list_pets_1_vu: 500,
  list_pets_100_vus: 500,
  list_pets_1000_vus: 2000,
  list_pets_10000_vus: null,
}

export const SCENARIOS = {
  list_pets_1_vu: { executor: 'constant-vus', vus: 1, duration: '30s', startTime: '0s' },
  list_pets_100_vus: { executor: 'constant-vus', vus: 100, duration: '1m', startTime: '1m' },
  list_pets_1000_vus: { executor: 'constant-vus', vus: 1000, duration: '2m', startTime: '3m' },
  list_pets_10000_vus: { executor: 'constant-vus', vus: 10000, duration: '2m', startTime: '6m' },
}

const latencyThresholds = Object.fromEntries(
  Object.entries(LATENCY_BUDGETS_MS)
    .filter(([, budget]) => budget !== null)
    .map(([name, budget]) => [`http_req_duration{scenario:${name}}`, [`p(95)<${budget}`]]),
)

export const THRESHOLDS = {
  ...latencyThresholds,
  // http_req_failed inclui 5xx (e também 4xx/erros de rede); `checks` reforça
  // explicitamente a regra "0 5xx" com CHECKS.no5xx.
  http_req_failed: ['rate==0'],
  checks: ['rate==1'],
}

export const options = {
  scenarios: SCENARIOS,
  thresholds: THRESHOLDS,
  summaryTrendStats: ['avg', 'min', 'med', 'p(95)', 'max'],
}

export function buildUrl(path) {
  return `${BASE_URL}${path}`
}

let nextRequest = 0

export function nextRequestPath() {
  const path = REQUEST_PATHS[nextRequest % REQUEST_PATHS.length]
  nextRequest += 1
  return path
}

/** `http` e `check` injetáveis mantêm o módulo testável sem instalar o k6. */
export function requestListPets(httpClient, checkFn) {
  const path = nextRequestPath()
  const response = httpClient.get(buildUrl(path), { tags: { endpoint: path } })
  checkFn(response, {
    [CHECKS.status]: (r) => r.status === 200,
    [CHECKS.no5xx]: (r) => r.status < 500,
  })
  return response
}

export default function () {
  // k6 disponibiliza `http` e `check` como globais; lê-los aqui (e não no topo)
  // permite que Node importe este arquivo sem k6 instalado.
  requestListPets(globalThis.http, globalThis.check)
}
