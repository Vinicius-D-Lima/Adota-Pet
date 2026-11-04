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
  it('retorna { data, total } com os 12 pets do seed e distância calculada', async () => {
    const res = await request(app).get('/pets')
    expect(res.status).toBe(200)
    expect(res.body.total).toBe(12)
    expect(res.body.data).toHaveLength(12)
    expect(res.body.data[0].distanceKm).toEqual(expect.any(Number))
  })

  it('aceita o prefixo /api', async () => {
    const res = await request(app).get('/api/pets')
    expect(res.body.total).toBe(12)
  })

  it('filtra por search e por filtros combinados', async () => {
    const byName = await request(app).get('/pets').query({ search: 'beagle' })
    expect(byName.body.data.map((p) => p.id)).toEqual(['bento'])
    const combined = await request(app).get('/pets').query({ species: 'Gato', sex: 'Fêmea' })
    expect(combined.body.total).toBe(3)
    expect(combined.body.data.every((p) => p.species === 'Gato' && p.sex === 'Fêmea')).toBe(true)
  })

  it('aceita parâmetro repetido como "um dos valores", também com sort=distance', async () => {
    const plain = await request(app).get('/pets?size=Pequeno&size=Médio')
    expect(plain.status).toBe(200)
    expect(plain.body.total).toBeGreaterThan(0)
    const sizes = new Set(plain.body.data.map((p) => p.size))
    expect([...sizes].every((size) => ['Pequeno', 'Médio'].includes(size))).toBe(true)

    const byDistance = await request(app).get('/pets?size=Pequeno&size=Médio&sort=distance')
    expect(byDistance.body.total).toBe(plain.body.total)
    const km = byDistance.body.data.map((p) => p.distanceKm)
    expect(km).toEqual([...km].sort((a, b) => a - b))
  })

  it('pagina e informa o total', async () => {
    const res = await request(app).get('/pets').query({ page: 2, limit: 4 })
    expect(res.body.data).toHaveLength(4)
    expect(res.body.total).toBe(12)
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
    expect(distance.body.total).toBe(12)
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

  it('cria e persiste o perfil de protetor independente', async () => {
    const before = await request(app).get('/me/guardian-profile')
    expect(before.body.isComplete).toBe(false)

    const payload = {
      guardianType: 'INDIVIDUAL',
      legalName: 'Ana Maria Souza',
      document: '529.982.247-25',
      email: 'ana@exemplo.com',
      phone: '(11) 99999-9999',
      zipCode: '01310-100',
      address: 'Avenida Paulista, 1000',
      city: 'São Paulo, SP',
      description: 'Trabalho com resgate e adoção responsável de cães e gatos.',
      acceptsTerms: true,
    }
    const put = await request(app).put('/me/guardian-profile').send(payload)
    expect(put.status).toBe(200)
    expect(put.body).toMatchObject({
      document: '52998224725',
      phone: '11999999999',
      zipCode: '01310100',
      isComplete: true,
      missingFields: [],
    })
    const me = await request(app).get('/me')
    expect(me.body.roles).toEqual(['ADOPTER', 'GUARDIAN'])
  })

  it('valida CNPJ quando o responsável é uma instituição', async () => {
    const invalid = await request(app).put('/me/guardian-profile').send({
      guardianType: 'ORGANIZATION',
      document: '11111111111111',
    })
    expectError(invalid, 400, 'Bad Request')
    expect(invalid.body.details[0].field).toBe('document')

    const valid = await request(app).put('/me/guardian-profile').send({
      guardianType: 'ORGANIZATION',
      document: '11222333000181',
    })
    expect(valid.status).toBe(200)
    expect(valid.body.document).toBe('11222333000181')
  })

  it('GET /me retorna o usuário de demonstração', async () => {
    const res = await request(app).get('/me')
    expect(res.body).toMatchObject({
      id: 'demo',
      email: 'demo@adotapet.local',
    })
  })

  it('grava os dados pessoais na conta sem armazenar a senha', async () => {
    const emptyAccount = { 'X-Demo-User-Id': 'demo-empty' }
    const payload = {
      name: 'Maria da Silva',
      cpf: '529.982.247-25',
      birthDate: '1990-05-20',
      email: 'maria@exemplo.com',
      phone: '(11) 99999-9999',
      zipCode: '01310-100',
      address: 'Avenida Paulista, 1000 - São Paulo, SP',
      password: 'senha123',
      accountType: 'adopter',
    }
    const put = await request(app).put('/me/account').set(emptyAccount).send(payload)

    expect(put.status).toBe(200)
    expect(put.body).toMatchObject({
      id: 'demo-empty',
      name: 'Maria da Silva',
      cpf: '52998224725',
      email: 'maria@exemplo.com',
      phone: '11999999999',
      zipCode: '01310100',
      role: 'ADOTANTE',
      roles: ['ADOPTER'],
    })
    expect(put.body).not.toHaveProperty('password')

    const me = await request(app).get('/me').set(emptyAccount)
    expect(me.body).toMatchObject({ name: 'Maria da Silva', cpf: '52998224725' })
    expect((await request(app).get('/me/adopter-profile').set(emptyAccount)).body.isComplete).toBe(
      false,
    )
  })

  it('rejeita a criação de conta com dados pessoais inválidos', async () => {
    const res = await request(app).put('/me/account').send({
      name: 'X',
      cpf: '11111111111',
      birthDate: '2020-01-01',
      email: 'invalido',
      phone: '1',
      zipCode: '2',
      address: 'x',
      password: '123',
      accountType: 'x',
    })
    expectError(res, 400, 'Bad Request')
    expect(res.body.details.map((detail) => detail.field)).toEqual([
      'name',
      'cpf',
      'birthDate',
      'email',
      'phone',
      'zipCode',
      'address',
      'password',
      'accountType',
    ])
  })

  it('grava identificação, contato e endereço da instituição no cadastro', async () => {
    const emptyAccount = { 'X-Demo-User-Id': 'demo-empty' }
    const payload = {
      accountType: 'guardian',
      organizationName: 'Instituto Patinhas',
      responsibleName: 'Maria da Silva',
      document: '11222333000181',
      email: 'contato@patinhas.org',
      phone: '11999999999',
      zipCode: '01310100',
      address: 'Avenida Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      password: 'senha123',
    }

    const response = await request(app).put('/me/account').set(emptyAccount).send(payload)

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      id: 'demo-empty',
      organizationName: 'Instituto Patinhas',
      responsibleName: 'Maria da Silva',
      document: '11222333000181',
      email: 'contato@patinhas.org',
      phone: '11999999999',
      zipCode: '01310100',
      address: 'Avenida Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      name: 'Maria da Silva',
      role: 'RESPONSAVEL',
      roles: ['GUARDIAN'],
    })
    expect(response.body).not.toHaveProperty('password')
  })

  it('separa o adotante e a instituição pelo cabeçalho de conta demo', async () => {
    const organization = { 'X-Demo-User-Id': 'demo-organization' }
    const me = await request(app).get('/me').set(organization)
    expect(me.body).toMatchObject({
      id: 'demo-organization',
      name: 'Instituto Patinhas',
      roles: ['GUARDIAN'],
    })

    const guardian = await request(app).get('/me/guardian-profile').set(organization)
    expect(guardian.body).toMatchObject({
      displayName: 'Instituto Patinhas',
      isComplete: true,
    })
    const adopter = await request(app).get('/me/adopter-profile').set(organization)
    expect(adopter.body.isComplete).toBe(false)
    expect((await request(app).get('/me/favorites/ids').set(organization)).body.total).toBe(0)
    expect((await request(app).get('/me/requests').set(organization)).body.total).toBe(0)
  })

  it('mantém uma terceira conta de teste sem nenhum dado de perfil', async () => {
    const emptyAccount = { 'X-Demo-User-Id': 'demo-empty' }
    const me = await request(app).get('/me').set(emptyAccount)
    expect(me.body).toMatchObject({
      id: 'demo-empty',
      name: '',
      email: '',
      roles: ['ADOPTER'],
    })

    const adopter = await request(app).get('/me/adopter-profile').set(emptyAccount)
    expect(adopter).toMatchObject({ status: 200 })
    expect(adopter.body).toMatchObject({ userId: 'demo-empty', isComplete: false })
    expect(adopter.body).not.toHaveProperty('name')
    expect(adopter.body.missingFields).toHaveLength(17)

    const guardian = await request(app).get('/me/guardian-profile').set(emptyAccount)
    expect(guardian.body).toMatchObject({ userId: 'demo-empty', isComplete: false })
    expect((await request(app).get('/me/favorites/ids').set(emptyAccount)).body.total).toBe(0)
    expect((await request(app).get('/me/requests').set(emptyAccount)).body.total).toBe(0)
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
    expect(mine.body.total).toBe(5)
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

describe('chat da solicitação', () => {
  const organization = { 'X-Demo-User-Id': 'demo-organization' }
  const outsider = { 'X-Demo-User-Id': 'demo-empty' }

  it('lista mensagens apenas para participantes e não devolve dados de contato', async () => {
    const created = await request(app)
      .post('/requests')
      .send({ petId: 'luna', answers: validAnswers })
    const requestId = created.body.id
    await request(app)
      .post(`/requests/${requestId}/messages`)
      .set(organization)
      .send({ body: 'Olá, vamos conversar?' })
    await request(app).post(`/requests/${requestId}/messages`).send({ body: 'Claro, obrigado!' })
    const adopterView = await request(app).get(`/requests/${requestId}/messages`)
    expect(adopterView.status).toBe(200)
    expect(adopterView.body).toMatchObject({
      unreadCount: 1,
      nextCursor: null,
      data: [
        { authorName: 'Instituto Patinhas', mine: false, readAt: null },
        { authorName: 'Lucas Ferreira', mine: true, readAt: null },
      ],
    })
    for (const message of adopterView.body.data) {
      expect(message).not.toHaveProperty('authorId')
      expect(message).not.toHaveProperty('email')
      expect(message).not.toHaveProperty('phone')
      expect(message).not.toHaveProperty('userId')
    }

    const organizationView = await request(app)
      .get(`/requests/${requestId}/messages`)
      .set(organization)
    expect(organizationView.body.unreadCount).toBe(1)
    expect(organizationView.body.data[0]).toMatchObject({
      authorName: 'Instituto Patinhas',
      mine: true,
    })
    expectError(
      await request(app).get(`/requests/${requestId}/messages`).set(outsider),
      403,
      'Forbidden',
    )
  })

  it('rejeita mensagens vazias, maiores que 2000 caracteres e campos extras', async () => {
    expectError(
      await request(app).post('/requests/SOL-1042/messages').send({ body: '  ' }),
      400,
      'Bad Request',
    )
    expectError(
      await request(app)
        .post('/requests/SOL-1042/messages')
        .send({ body: 'x'.repeat(2001) }),
      400,
      'Bad Request',
    )
    expectError(
      await request(app)
        .post('/requests/SOL-1042/messages')
        .send({ body: 'Olá', email: 'contato@example.com' }),
      400,
      'Bad Request',
    )
  })

  it('envia texto puro e mantém o HTML como conteúdo literal', async () => {
    const created = await request(app)
      .post('/requests')
      .send({ petId: 'luna', answers: validAnswers })
    const requestId = created.body.id
    const body = '<script>alert(1)</script>'
    const sent = await request(app).post(`/requests/${requestId}/messages`).send({ body })
    expect(sent.status).toBe(201)
    expect(sent.body).toMatchObject({ body, mine: true, authorName: 'Lucas Ferreira' })
    expect(sent.body).not.toHaveProperty('authorId')
    const fromOrganization = await request(app)
      .get(`/requests/${requestId}/messages`)
      .set(organization)
    expect(fromOrganization.body.data.at(-1)).toMatchObject({
      body,
      mine: false,
      authorName: 'Lucas Ferreira',
    })
  })

  it('pagina mensagens antigas com cursor em ordem cronológica', async () => {
    const db = seed()
    db.chatMessages = Array.from({ length: 23 }, (_, index) => ({
      id: `MSG-${String(index + 1).padStart(4, '0')}`,
      requestId: 'SOL-1042',
      authorId: index % 2 ? 'demo' : 'demo-organization',
      body: `Mensagem ${index + 1}`,
      createdAt: new Date(Date.UTC(2026, 9, 25, 12, index)).toISOString(),
      readAt: null,
    }))
    const pagedApp = createApp({ db, delay: 0 })
    const first = await request(pagedApp).get('/requests/SOL-1042/messages')
    expect(first.body.data).toHaveLength(20)
    expect(first.body.data[0].body).toBe('Mensagem 4')
    expect(first.body.data.at(-1).body).toBe('Mensagem 23')
    expect(first.body.nextCursor).toBe('MSG-0004')

    const previous = await request(pagedApp)
      .get('/requests/SOL-1042/messages')
      .query({ cursor: first.body.nextCursor })
    expect(previous.body.data.map(({ body }) => body)).toEqual([
      'Mensagem 1',
      'Mensagem 2',
      'Mensagem 3',
    ])
    expect(previous.body.nextCursor).toBeNull()
  })

  it('bloqueia envio após estado final e marca apenas mensagens recebidas como lidas', async () => {
    const db = seed()
    db.requests.find(({ id }) => id === 'SOL-1039').status = 'Aprovada'
    const finalApp = createApp({ db, delay: 0 })
    expectError(
      await request(finalApp).post('/requests/SOL-1039/messages').send({ body: 'Mais uma' }),
      409,
      'Conflict',
    )

    const requestWithUnread = (await request(app).get('/me/requests')).body.data.find(
      ({ id }) => id === 'SOL-1039',
    )
    expect(requestWithUnread.unreadMessageCount).toBe(1)
    expect((await request(app).patch('/requests/SOL-1039/messages/read')).status).toBe(204)
    const requestAfterRead = (await request(app).get('/me/requests')).body.data.find(
      ({ id }) => id === 'SOL-1039',
    )
    expect(requestAfterRead.unreadMessageCount).toBe(0)
    const readMessages = (await request(app).get('/requests/SOL-1039/messages')).body.data
    expect(readMessages[0].readAt).toEqual(expect.any(String))
    expect(readMessages[1].readAt).toBeNull()
  })

  it('impede leitura, envio e marcação de leitura para outras contas', async () => {
    expectError(
      await request(app).post('/requests/SOL-1042/messages').set(outsider).send({ body: 'Oi' }),
      403,
      'Forbidden',
    )
    expectError(
      await request(app).patch('/requests/SOL-1042/messages/read').set(outsider),
      403,
      'Forbidden',
    )
    expectError(await request(app).get('/requests/inexistente/messages'), 404, 'Not Found')
  })
})

describe('solicitações do seed', () => {
  it('traz um exemplo de cada status para demonstrar a listagem', async () => {
    const mine = await request(app).get('/me/requests')
    expect(mine.body.data.map((r) => r.status).sort()).toEqual([
      'Aprovada',
      'Cancelada',
      'Em análise',
      'Recusada',
    ])
  })

  it('não permite cancelar uma solicitação já aprovada ou recusada (409)', async () => {
    for (const id of ['SOL-1039', 'SOL-1040']) {
      expectError(
        await request(app).post(`/requests/${id}/transitions`).send({ to: 'CANCELADA' }),
        409,
        'Conflict',
      )
    }
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

describe('notificações', () => {
  const organization = { 'X-Demo-User-Id': 'demo-organization' }

  it('lista somente notificações da conta, com unreadCount e filtro de não lidas', async () => {
    const all = await request(app).get('/me/notifications')
    expect(all.status).toBe(200)
    expect(all.body.data).toHaveLength(3)
    expect(all.body.unreadCount).toBe(2)
    expect(all.body.data[0]).toMatchObject({
      id: 'NOT-1003',
      type: 'MessageReceived',
      readAt: null,
    })
    expect(all.body.data[0]).not.toHaveProperty('userId')

    const unread = await request(app).get('/me/notifications').query({ unread: true })
    expect(unread.body.data).toHaveLength(2)
    expect(unread.body.data.every((notification) => notification.readAt === null)).toBe(true)
    expect(unread.body.unreadCount).toBe(2)
  })

  it('pagina com cursor e rejeita parâmetros inválidos', async () => {
    const db = seed()
    db.notifications = Array.from({ length: 7 }, (_, index) => ({
      id: `NOT-${index}`,
      userId: 'demo',
      type: 'MessageReceived',
      title: `Notificação ${index}`,
      body: 'Mensagem de teste.',
      link: '/solicitacoes',
      readAt: null,
      createdAt: new Date(Date.UTC(2026, 9, 25, 0, index)).toISOString(),
    }))
    const pagedApp = createApp({ db, delay: 0 })
    const first = await request(pagedApp).get('/me/notifications')
    expect(first.body.data).toHaveLength(5)
    expect(first.body.nextCursor).toBe(first.body.data[4].id)

    const second = await request(pagedApp)
      .get('/me/notifications')
      .query({ cursor: first.body.nextCursor })
    expect(second.body.data).toHaveLength(2)
    expect(second.body.nextCursor).toBeNull()

    expectError(
      await request(app).get('/me/notifications').query({ unread: 'yes' }),
      400,
      'Bad Request',
    )
    expectError(
      await request(app).get('/me/notifications').query({ cursor: 'not-found' }),
      400,
      'Bad Request',
    )
  })

  it('marca uma ou todas como lidas sem acessar notificações de outra conta', async () => {
    expectError(await request(app).patch('/me/notifications/NOT-2001/read'), 404, 'Not Found')

    expect((await request(app).patch('/me/notifications/NOT-1003/read')).status).toBe(204)
    let list = await request(app).get('/me/notifications')
    expect(list.body.unreadCount).toBe(1)
    expect(list.body.data.find(({ id }) => id === 'NOT-1003').readAt).toEqual(expect.any(String))

    expect((await request(app).patch('/me/notifications/read-all')).status).toBe(204)
    list = await request(app).get('/me/notifications')
    expect(list.body.unreadCount).toBe(0)
    expect((await request(app).get('/me/notifications').set(organization)).body.unreadCount).toBe(1)
  })

  it('carrega preferências padrão e persiste a lista atualizada por usuário', async () => {
    const initial = await request(app).get('/me/notification-preferences')
    expect(initial.status).toBe(200)
    expect(initial.body.data).toHaveLength(9)
    expect(initial.body.data.find(({ type }) => type === 'MessageReceived')).toMatchObject({
      inApp: true,
      email: false,
    })

    const preferences = initial.body.data.map((preference) =>
      preference.type === 'MessageReceived' ? { ...preference, email: true } : preference,
    )
    const updated = await request(app)
      .put('/me/notification-preferences')
      .send({ data: preferences })
    expect(updated.body.data.find(({ type }) => type === 'MessageReceived').email).toBe(true)
    expect(
      (await request(app).get('/me/notification-preferences')).body.data.find(
        ({ type }) => type === 'MessageReceived',
      ).email,
    ).toBe(true)
    expect(
      (await request(app).get('/me/notification-preferences').set(organization)).body.data.find(
        ({ type }) => type === 'MessageReceived',
      ).email,
    ).toBe(false)
  })

  it('rejeita lista de preferências incompleta', async () => {
    expectError(
      await request(app).put('/me/notification-preferences').send({ data: [] }),
      400,
      'Bad Request',
    )
  })
})

describe('filtros salvos', () => {
  const filter = {
    name: 'Gatos pequenos',
    criteria: { species: 'Gato', size: ['Pequeno'] },
    active: false,
  }
  const organization = { 'X-Demo-User-Id': 'demo-organization' }

  it('cria, lista, atualiza e exclui buscas isoladas por usuário', async () => {
    const created = await request(app).post('/me/saved-filters').send(filter)
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      id: expect.any(String),
      name: filter.name,
      criteria: filter.criteria,
      active: false,
      createdAt: expect.any(String),
    })
    expect(created.body).not.toHaveProperty('userId')

    const ownList = await request(app).get('/me/saved-filters')
    expect(ownList.body).toMatchObject({ total: 1, data: [created.body] })
    expect((await request(app).get('/me/saved-filters').set(organization)).body.total).toBe(0)

    const updated = await request(app)
      .patch(`/me/saved-filters/${created.body.id}`)
      .send({ name: 'Gatos pequenos em alerta', active: true })
    expect(updated.body).toMatchObject({
      name: 'Gatos pequenos em alerta',
      active: true,
      criteria: filter.criteria,
    })
    expect((await request(app).delete(`/me/saved-filters/${created.body.id}`)).status).toBe(204)
    expect((await request(app).get('/me/saved-filters')).body.total).toBe(0)
  })

  it('rejeita critérios desconhecidos e valores fora dos enums', async () => {
    const unknown = await request(app)
      .post('/me/saved-filters')
      .send({ ...filter, criteria: { ...filter.criteria, cityName: 'São Paulo' } })
    expectError(unknown, 400, 'Bad Request')
    expect(unknown.body.details).toContainEqual({
      field: 'criteria.cityName',
      message: 'Critério desconhecido',
    })

    const invalid = await request(app)
      .post('/me/saved-filters')
      .send({ ...filter, criteria: { species: 'Ave' } })
    expectError(invalid, 400, 'Bad Request')
    expect(invalid.body.details[0].field).toBe('criteria.species')
  })

  it('retorna 409 no 11º filtro e impede alterações de outra conta', async () => {
    const created = await request(app).post('/me/saved-filters').send(filter)
    for (let index = 1; index < 10; index += 1) {
      const response = await request(app)
        .post('/me/saved-filters')
        .send({ ...filter, name: `Busca ${index}` })
      expect(response.status).toBe(201)
    }

    expectError(
      await request(app)
        .post('/me/saved-filters')
        .send({ ...filter, name: 'Busca 11' }),
      409,
      'Conflict',
    )
    expectError(
      await request(app)
        .patch(`/me/saved-filters/${created.body.id}`)
        .set(organization)
        .send({ active: true }),
      404,
      'Not Found',
    )
    expectError(
      await request(app).delete(`/me/saved-filters/${created.body.id}`).set(organization),
      404,
      'Not Found',
    )
  })
})

describe('área da instituição', () => {
  const guardian = { 'X-Demo-User-Id': 'demo-organization' }
  const petPayload = {
    name: 'Pet Teste Institucional',
    species: 'Gato',
    breed: 'SRD',
    age: 2,
    size: 'Pequeno',
    sex: 'Fêmea',
    city: 'São Paulo, SP',
    image: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5',
    summary: 'Carinhosa e muito tranquila.',
    description: 'Amora procura uma família cuidadosa e uma casa com janelas teladas.',
    traits: ['Carinhosa', 'Tranquila'],
    energy: 'Baixa',
    space: 'Apartamento telado',
    children: true,
    otherPets: true,
    specialCare: false,
    vaccinated: true,
    neutered: true,
  }

  it('lista somente os pets da instituição autenticada', async () => {
    const res = await request(app).get('/me/organization-pets').set(guardian)
    expect(res.status).toBe(200)
    expect(res.body.data.map((pet) => pet.id)).toEqual(expect.arrayContaining(['fred', 'luna']))
    expect(res.body.data.every((pet) => pet.organization === 'Instituto Patinhas')).toBe(true)
  })

  it('cadastra, edita e remove um pet da própria instituição', async () => {
    const created = await request(app).post('/me/organization-pets').set(guardian).send(petPayload)
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({
      id: 'pet-teste-institucional',
      organization: 'Instituto Patinhas',
    })

    const updated = await request(app)
      .put(`/me/organization-pets/${created.body.id}`)
      .set(guardian)
      .send({ ...petPayload, age: 3 })
    expect(updated.body).toMatchObject({ age: 3, ageLabel: '3 anos' })
    expect(
      (await request(app).delete(`/me/organization-pets/${created.body.id}`).set(guardian)).status,
    ).toBe(204)
  })

  it('lista solicitações dos próprios pets e permite analisar e aprovar', async () => {
    const created = await request(app)
      .post('/requests')
      .send({ petId: 'luna', answers: validAnswers })
    const list = await request(app).get('/me/received-requests').set(guardian)
    expect(list.body.data.find(({ id }) => id === created.body.id)).toMatchObject({
      petId: 'luna',
      adopter: { name: 'Lucas Ferreira', completion: 100 },
    })

    const review = await request(app)
      .post(`/me/received-requests/${created.body.id}/transitions`)
      .set(guardian)
      .send({ to: 'EM_ANALISE' })
    expect(review.body.status).toBe('Em análise')
    const approved = await request(app)
      .post(`/me/received-requests/${created.body.id}/transitions`)
      .set(guardian)
      .send({ to: 'APROVADA' })
    expect(approved.body.status).toBe('Aprovada')
  })

  it('impede que uma conta de adotante use as rotas institucionais', async () => {
    expectError(await request(app).get('/me/organization-pets'), 403, 'Forbidden')
    expectError(await request(app).get('/me/received-requests'), 403, 'Forbidden')
  })
})
