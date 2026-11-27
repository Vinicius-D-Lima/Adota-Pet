import { describe, expect, it } from 'vitest'

// Script k6 em JS puro: sem declarações de tipo para o tsc. O caminho em
// variável faz o import dinâmico só no Vitest, sem executar carga nem exigir k6.
const scriptPath = '../tests/performance/list-pets.js'
const {
  BASE_URL,
  CHECKS,
  ENDPOINTS,
  LATENCY_BUDGETS_MS,
  REQUEST_PATHS,
  SCENARIOS,
  THRESHOLDS,
  buildUrl,
  options,
  requestListPets,
  default: loadPets,
} = await import(scriptPath)

describe('configuração do teste de performance da listagem de pets', () => {
  it('[LOAD-01] define quatro cenários nomeados com 1, 100, 1000 e 10000 VUs', () => {
    const expected = [
      ['list_pets_1_vu', 1],
      ['list_pets_100_vus', 100],
      ['list_pets_1000_vus', 1000],
      ['list_pets_10000_vus', 10000],
    ] as const

    expect(Object.keys(SCENARIOS)).toEqual(expected.map(([name]) => name))
    for (const [name, vus] of expected) {
      expect(SCENARIOS[name]).toMatchObject({ executor: 'constant-vus', vus })
    }
    expect(options.scenarios).toBe(SCENARIOS)
  })

  it('[LOAD-02] BASE_URL tem default localhost e compõe URLs absolutas', () => {
    expect(BASE_URL).toBe('http://localhost:3000')
    expect(buildUrl(ENDPOINTS.recent)).toBe(
      'http://localhost:3000/api/pets?sort=recent&limit=12&page=1',
    )
  })

  it('[LOAD-03] usa a rota principal de listagem recente com paginação padrão', () => {
    expect(ENDPOINTS.recent).toBe('/api/pets?sort=recent&limit=12&page=1')
    expect(REQUEST_PATHS).toContain(ENDPOINTS.recent)
  })

  it('[LOAD-04] cobre filtros e sort=distance com coordenadas válidas', () => {
    const filters = new URL(ENDPOINTS.filters, BASE_URL)
    expect(filters.pathname).toBe('/api/pets')
    expect(filters.searchParams.get('sort')).toBe('recent')
    expect(filters.searchParams.get('species')).toBe('Cachorro')
    expect(filters.searchParams.get('size')).toBe('Médio')
    expect(filters.searchParams.get('sex')).toBe('Fêmea')
    expect(filters.searchParams.get('city')).toBe('São Paulo')

    const distance = new URL(ENDPOINTS.distance, BASE_URL)
    expect(distance.pathname).toBe('/api/pets')
    expect(distance.searchParams.get('sort')).toBe('distance')
    const lat = Number(distance.searchParams.get('lat'))
    const lng = Number(distance.searchParams.get('lng'))
    expect(lat).toBeGreaterThanOrEqual(-90)
    expect(lat).toBeLessThanOrEqual(90)
    expect(lng).toBeGreaterThanOrEqual(-180)
    expect(lng).toBeLessThanOrEqual(180)

    expect(REQUEST_PATHS).toEqual([ENDPOINTS.recent, ENDPOINTS.filters, ENDPOINTS.distance])
  })

  it('[LOAD-05] thresholds exigem p95 < 500ms até 100 VUs, < 2s em 1000 e zero 5xx', () => {
    expect(LATENCY_BUDGETS_MS).toEqual({
      list_pets_1_vu: 500,
      list_pets_100_vus: 500,
      list_pets_1000_vus: 2000,
      list_pets_10000_vus: null,
    })
    for (const name of ['list_pets_1_vu', 'list_pets_100_vus']) {
      expect(THRESHOLDS[`http_req_duration{scenario:${name}}`]).toEqual(['p(95)<500'])
    }
    expect(THRESHOLDS['http_req_duration{scenario:list_pets_1000_vus}']).toEqual(['p(95)<2000'])
    // 10.000 VUs são diagnóstico: não devem derrubar a execução por latência.
    expect(THRESHOLDS['http_req_duration{scenario:list_pets_10000_vus}']).toBeUndefined()
    expect(THRESHOLDS.http_req_failed).toContain('rate==0')
    expect(THRESHOLDS.checks).toContain('rate==1')
    expect(CHECKS.no5xx).toMatch(/5xx/)
    expect(options.thresholds).toBe(THRESHOLDS)
  })

  it('[LOAD-06] módulo é importável em Node e injeta http/check sem carga real', () => {
    expect(typeof loadPets).toBe('function')

    let requestedUrl = ''
    let checkedKeys: string[] = []
    const fakeHttp = {
      get: (url: string) => {
        requestedUrl = url
        return { status: 200, timings: { duration: 10 } }
      },
    }
    const fakeCheck = (_response: unknown, checks: Record<string, unknown>) => {
      checkedKeys = Object.keys(checks)
      return true
    }

    const response = requestListPets(fakeHttp, fakeCheck)

    expect(requestedUrl).toBe(buildUrl(ENDPOINTS.recent))
    expect(response.status).toBe(200)
    expect(checkedKeys).toEqual([CHECKS.status, CHECKS.no5xx])
  })
})
