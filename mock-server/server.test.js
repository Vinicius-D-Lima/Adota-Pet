// @vitest-environment node
import { readFileSync } from 'node:fs'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { SEED_PATH, createApp } from './server.js'

const seed = () => JSON.parse(readFileSync(SEED_PATH, 'utf8'))
const validAnswers = {
  motivation: 'Quero muito adotar e dar um lar com carinho.',
  routine: 'Trabalho em casa e passeio todos os dias.',
  aloneTime: 'Até 4 horas',
  adaptation: 'Vou preparar um espaço tranquilo.',
  costs: true,
  commitment: true,
}

let app
beforeEach(() => {
  app = createApp({ db: seed(), delay: 0 })
})

const expectError = (res, statusCode, error) => {
  expect(res.status).toBe(statusCode)
  expect(res.body).toMatchObject({ statusCode, error })
  expect(typeof res.body.message).toBe('string')
}

describe('GET /pets', () => {
  it('retorna { data, total } com os 6 pets do seed e distância calculada', async () => {
    const res = await request(app).get('/pets')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(6)
    expect(res.body.data).toHaveLength(6)
    expect(res.body.data[0].distanceKm).toEqual(expect.any(Number))
  })

  it('aceita o prefixo /api', async () => {
    const res = await request(app).get('/api/pets')
    expect(res.body.total).toBe(6)
  })

  it('filtra por search e por filtros combinados', async () => {
    const byName = await request(app).get('/pets').query({ search: 'beagle' })
    expect(byName.body.data.map((p) => p.id)).toEqual(['bento'])
    const combined = await request(app).get('/pets').query({ species: 'Gato', sex: 'Fêmea' })
    expect(combined.body.total).toBe(2)
    expect(combined.body.data.every((p) => p.species === 'Gato' && p.sex === 'Fêmea')).toBe(true)
  })

  it('pagina e informa o total', async () => {
    const res = await request(app).get('/pets').query({ page: 2, limit: 4 })
    expect(res.body.data).toHaveLength(2)
    expect(res.body.total).toBe(6)
  })

  it('ordena por recent, name e distance', async () => {
    const recent = await request(app).get('/pets').query({ sort: 'recent' })
    expect(recent.body.data[0].id).toBe('luna')
    const name = await request(app).get('/pets').query({ sort: 'name' })
    const names = name.body.data.map((p) => p.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    const distance = await request(app).get('/pets').query({ sort: 'distance', limit: 3 })
    const km = distance.body.data.map((p) => p.distanceKm)
    expect(km).toEqual([...km].sort((a, b) => a - b))
    expect(distance.body.total).toBe(6)
  })

  it('retorna 400 com details para parâmetros inválidos', async () => {
    const res = await request(app).get('/pets').query({ sort: 'x', page: 0 })
    expectError(res, 400, 'Bad Request')
    expect(res.body.details.map((d) => d.field)).toEqual(['page', 'sort'])
  })

  it('retorna 400 apontando parâmetros desconhecidos em vez de lista vazia', async () => {
    const res = await request(app).get('/pets').query({ lat: 1, lng: 2, species: 'Gato' })
    expectError(res, 400, 'Bad Request')
    expect(res.body.details).toEqual([
      { field: 'lat', message: 'Parâmetro desconhecido' },
      { field: 'lng', message: 'Parâmetro desconhecido' },
    ])
    const city = await request(app).get('/pets').query({ city: 'Nowhere' })
    expect(city.status).toBe(200)
  })

  it('retorna 404 no formato padrão para pet inexistente', async () => {
    expectError(await request(app).get('/pets/nao-existe'), 404, 'Not Found')
    const found = await request(app).get('/pets/luna')
    expect(found.body.name).toBe('Luna')
  })
})

describe('perfil', () => {
  it('retorna o perfil com isComplete e persiste a atualização', async () => {
    const before = await request(app).get('/me/adopter-profile')
    expect(before.body.isComplete).toBe(true)
    const put = await request(app).put('/me/adopter-profile').send({ housing: '' })
    expect(put.body.isComplete).toBe(false)
    const after = await request(app).get('/me/adopter-profile')
    expect(after.body.isComplete).toBe(false)
  })

  it('seed novo devolve isComplete true e missingFields vazio', async () => {
    const res = await request(app).get('/me/adopter-profile')
    expect(res.body).toMatchObject({ isComplete: true, missingFields: [] })
    expect(res.body.cpf).toBe('52998224725')
  })

  it('persiste os campos novos e guarda cpf, phone e zipCode só com dígitos', async () => {
    const put = await request(app).put('/me/adopter-profile').send({
      cpf: '111.444.777-35',
      phone: '(21) 98888-7777',
      zipCode: '20040-020',
      birthDate: '1990-01-15',
      email: 'novo@exemplo.com',
      address: 'Rua das Flores, 123',
    })
    expect(put.status).toBe(200)
    const get = await request(app).get('/me/adopter-profile')
    expect(get.body).toMatchObject({
      cpf: '11144477735',
      phone: '21988887777',
      zipCode: '20040020',
      birthDate: '1990-01-15',
      email: 'novo@exemplo.com',
      address: 'Rua das Flores, 123',
      isComplete: true,
    })
  })

  it('rejeita cpf inválido, menor de 18, e-mail inválido e CEP curto com details por campo', async () => {
    const year = new Date().getFullYear() - 10
    const res = await request(app)
      .put('/me/adopter-profile')
      .send({ cpf: '111.111.111-11', birthDate: `${year}-01-01`, email: 'x', zipCode: '123' })
    expectError(res, 400, 'Bad Request')
    expect(res.body.details.map((d) => d.field)).toEqual(['cpf', 'birthDate', 'email', 'zipCode'])
    const badDigit = await request(app).put('/me/adopter-profile').send({ cpf: '52998224726' })
    expect(badDigit.body.details[0].field).toBe('cpf')
    const badDate = await request(app).put('/me/adopter-profile').send({ birthDate: '1990-02-31' })
    expect(badDate.body.details[0].field).toBe('birthDate')
  })

  it('rejeita valor fora do enum, telefone, endereço e nome curtos', async () => {
    const res = await request(app)
      .put('/me/adopter-profile')
      .send({ housing: 'Castelo', phone: '123', address: 'abc', name: 'Jo' })
    expectError(res, 400, 'Bad Request')
    expect(res.body.details.map((d) => d.field)).toEqual(['name', 'phone', 'address', 'housing'])
  })

  it('apagar um campo torna isComplete false e o lista em missingFields', async () => {
    await request(app).put('/me/adopter-profile').send({ cpf: '', address: '' })
    const res = await request(app).get('/me/adopter-profile')
    expect(res.body.isComplete).toBe(false)
    expect(res.body.missingFields).toEqual(['cpf', 'address'])
  })

  it('sobe com db antigo: perfil incompleto com os campos novos em missingFields', async () => {
    const old = seed()
    for (const key of ['cpf', 'birthDate', 'email', 'phone', 'zipCode', 'address'])
      delete old.profile[key]
    const oldApp = createApp({ db: old, delay: 0 })
    const res = await request(oldApp).get('/me/adopter-profile')
    expect(res.status).toBe(200)
    expect(res.body.isComplete).toBe(false)
    expect(res.body.missingFields).toEqual([
      'cpf',
      'birthDate',
      'email',
      'phone',
      'zipCode',
      'address',
    ])
  })

  it('rejeita tipos inválidos com 400', async () => {
    const res = await request(app).put('/me/adopter-profile').send({ hasChildren: 'sim' })
    expectError(res, 400, 'Bad Request')
    expect(res.body.details[0].field).toBe('hasChildren')
  })

  it('GET /me retorna o usuário de demonstração', async () => {
    const res = await request(app).get('/me')
    expect(res.body).toMatchObject({
      id: 'demo',
      email: 'demo@adotapet.local',
    })
  })
})

describe('POST /requests', () => {
  it('cria a solicitação com id e data gerados pelo servidor', async () => {
    const res = await request(app).post('/requests').send({ petId: 'luna', answers: validAnswers })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      id: 'SOL-1043',
      status: 'Enviada',
      petId: 'luna',
    })
    expect(Date.parse(res.body.date)).not.toBeNaN()
    const mine = await request(app).get('/me/requests')
    expect(mine.body.total).toBe(2)
    expect(mine.body.data[0].id).toBe('SOL-1043')
    expect((await request(app).get('/requests/SOL-1043')).body.pet.name).toBe('Luna')
  })

  it('retorna 400 com details por campo quando o questionário é inválido', async () => {
    const res = await request(app)
      .post('/requests')
      .send({
        petId: 'luna',
        answers: { ...validAnswers, motivation: 'curto', costs: false },
      })
    expectError(res, 400, 'Bad Request')
    expect(res.body.details.map((d) => d.field)).toEqual(['answers.motivation', 'answers.costs'])
  })

  it('retorna 404 para pet inexistente', async () => {
    const res = await request(app)
      .post('/requests')
      .send({ petId: 'fantasma', answers: validAnswers })
    expectError(res, 404, 'Not Found')
  })

  it('retorna 422 quando o perfil está incompleto', async () => {
    await request(app).put('/me/adopter-profile').send({ name: '' })
    const res = await request(app).post('/requests').send({ petId: 'luna', answers: validAnswers })
    expectError(res, 422, 'Unprocessable Entity')
    expect(res.body.details).toEqual([expect.objectContaining({ field: 'name' })])
  })

  it('retorna 409 para solicitação ativa duplicada no mesmo pet', async () => {
    const res = await request(app).post('/requests').send({ petId: 'mimi', answers: validAnswers })
    expectError(res, 409, 'Conflict')
  })

  it('permite nova solicitação depois de cancelar a anterior', async () => {
    await request(app).post('/requests/SOL-1042/transitions').send({ to: 'CANCELADA' })
    const res = await request(app).post('/requests').send({ petId: 'mimi', answers: validAnswers })
    expect(res.status).toBe(201)
  })
})

describe('POST /requests/:id/transitions', () => {
  it('cancela uma solicitação ativa', async () => {
    const res = await request(app).post('/requests/SOL-1042/transitions').send({ to: 'CANCELADA' })
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('Cancelada')
  })

  it('retorna 409 ao cancelar de novo, 404 para id inexistente e 400 para destino inválido', async () => {
    await request(app).post('/requests/SOL-1042/transitions').send({ to: 'CANCELADA' })
    expectError(
      await request(app).post('/requests/SOL-1042/transitions').send({ to: 'CANCELADA' }),
      409,
      'Conflict',
    )
    expectError(
      await request(app).post('/requests/SOL-9999/transitions').send({ to: 'CANCELADA' }),
      404,
      'Not Found',
    )
    expectError(
      await request(app).post('/requests/SOL-1042/transitions').send({ to: 'APROVADA' }),
      400,
      'Bad Request',
    )
  })
})

describe('favoritos', () => {
  it('lista, adiciona (idempotente) e remove favoritos', async () => {
    expect((await request(app).get('/me/favorites/ids')).body.data).toEqual(['luna'])
    expect((await request(app).put('/me/favorites/bento')).status).toBe(204)
    expect((await request(app).put('/me/favorites/bento')).status).toBe(204)
    const ids = (await request(app).get('/me/favorites/ids')).body
    expect(ids.data).toEqual(['luna', 'bento'])
    const favorites = await request(app).get('/me/favorites')
    expect(favorites.body.data.map((p) => p.id)).toEqual(['luna', 'bento'])
    expect((await request(app).delete('/me/favorites/luna')).status).toBe(204)
    expect((await request(app).get('/me/favorites/ids')).body.data).toEqual(['bento'])
  })

  it('retorna 404 ao favoritar pet inexistente', async () => {
    expectError(await request(app).put('/me/favorites/fantasma'), 404, 'Not Found')
  })
})
