import type { Express } from 'express'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasTestDatabase } from '../test/database.js'
import { resetTestDatabase } from '../test/reset.js'
import { createApp } from './app.js'
import { signAccessToken } from './auth.js'
import { prisma } from './db.js'

const databaseSuite = hasTestDatabase() ? describe : describe.skip
const DAY_MS = 24 * 60 * 60 * 1000
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

async function makeUser(id: string) {
  const user = await prisma.user.create({
    data: {
      id,
      name: `Pessoa ${id}`,
      email: `${id}@exemplo.com`,
      platformRole: 'USUARIO',
      role: 'ADOTANTE',
    },
  })
  const { token } = await signAccessToken(user)
  return { user, headers: bearer(token) }
}

async function makeOrganization(id: string) {
  return prisma.organization.create({
    data: { id, name: `Organização ${id}`, initials: 'RT' },
  })
}

async function addMembership(userId: string, organizationId: string) {
  return prisma.membership.create({
    data: { userId, organizationId, role: 'ADMIN', status: 'ATIVO' },
  })
}

async function makeAdoption(
  id: string,
  adopterId: string,
  organizationId: string,
  adoptedAt = new Date(Date.now() - 8 * DAY_MS),
) {
  const pet = await prisma.pet.create({
    data: {
      id: `${id}-pet`,
      name: `Pet ${id}`,
      species: 'Cachorro',
      breed: 'SRD',
      age: 2,
      ageLabel: '2 anos',
      size: 'Médio',
      sex: 'Fêmea',
      city: 'São Paulo',
      image: 'https://example.com/pet.jpg',
      summary: 'Pet de teste',
      description: 'Pet de teste para avaliação.',
      traits: ['Calmo'],
      energy: 'Moderada',
      space: 'Apartamento',
      children: true,
      otherPets: true,
      specialCare: false,
      vaccinated: true,
      neutered: true,
      organization: 'Organização de teste',
      organizationInitials: 'OT',
      createdAt: new Date(),
    },
  })
  const adoptionRequest = await prisma.adoptionRequest.create({
    data: {
      id: `${id}-request`,
      userId: adopterId,
      petId: pet.id,
      status: 'APROVADA',
      date: new Date(),
      message: 'Adoção para teste',
    },
  })
  return prisma.adoption.create({
    data: {
      id,
      requestId: adoptionRequest.id,
      petId: pet.id,
      adopterId,
      organizationId,
      adoptedAt,
    },
  })
}

async function addReview(
  adoptionId: string,
  reviewerId: string,
  rating: number,
  direction: 'ADOPTER_TO_ORGANIZATION' | 'ORGANIZATION_TO_ADOPTER',
  revieweeId: string | null,
  revieweeOrganizationId: string | null,
  createdAt = new Date(),
) {
  return prisma.review.create({
    data: {
      adoptionId,
      reviewerId,
      direction,
      revieweeId,
      revieweeOrganizationId,
      rating,
      createdAt,
    },
  })
}

databaseSuite('avaliações e reputação (#25)', () => {
  let app: Express

  beforeEach(async () => {
    await resetTestDatabase()
    app = createApp()
  })

  afterEach(async () => {
    await resetTestDatabase()
  })

  it('[REV-01] somente participantes da adoção podem avaliar', async () => {
    const adopter = await makeUser('rev-01-adopter')
    const outsider = await makeUser('rev-01-outsider')
    const organization = await makeOrganization('rev-01-org')
    const adoption = await makeAdoption('rev-01-adoption', adopter.user.id, organization.id)

    const response = await request(app)
      .post(`/api/adoptions/${adoption.id}/reviews`)
      .set(outsider.headers)
      .send({ rating: 5, comment: 'Tudo certo' })

    expect(response.status).toBe(403)
  })

  it('[REV-02] cada lado avalia uma vez e avaliações bilaterais são aceitas', async () => {
    const adopter = await makeUser('rev-02-adopter')
    const member = await makeUser('rev-02-member')
    const organization = await makeOrganization('rev-02-org')
    await addMembership(member.user.id, organization.id)
    const adoption = await makeAdoption('rev-02-adoption', adopter.user.id, organization.id)

    const first = await request(app)
      .post(`/api/adoptions/${adoption.id}/reviews`)
      .set(adopter.headers)
      .send({ rating: 5, comment: 'Boa experiência' })
    const duplicate = await request(app)
      .post(`/api/adoptions/${adoption.id}/reviews`)
      .set(adopter.headers)
      .send({ rating: 4, comment: 'Outra tentativa' })
    const otherSide = await request(app)
      .post(`/api/adoptions/${adoption.id}/reviews`)
      .set(member.headers)
      .send({ rating: 4, comment: 'Boa adoção' })
    const adopterReputation = await request(app).get(
      `/api/users/${adopter.user.id}/reputation`,
    )

    expect(first.status).toBe(201)
    expect(duplicate.status).toBe(409)
    expect(otherSide.status).toBe(201)
    expect(otherSide.body.direction).toBe('ORGANIZATION_TO_ADOPTER')
    expect(adopterReputation.status).toBe(200)
    expect(adopterReputation.body.count).toBe(1)
  })

  it('[REV-03] notas e comentários fora do limite são rejeitados', async () => {
    const adopter = await makeUser('rev-03-adopter')
    const organization = await makeOrganization('rev-03-org')
    const adoption = await makeAdoption('rev-03-adoption', adopter.user.id, organization.id)
    const invalidBodies = [
      { rating: 0, comment: 'inválido' },
      { rating: 6, comment: 'inválido' },
      { rating: 3, comment: 'x'.repeat(1001) },
    ]

    for (const body of invalidBodies) {
      const response = await request(app)
        .post(`/api/adoptions/${adoption.id}/reviews`)
        .set(adopter.headers)
        .send(body)
      expect(response.status).toBe(400)
    }
  })

  it('[REV-04] reputação pública exclui avaliações ocultadas', async () => {
    const organization = await makeOrganization('rev-04-org')
    const ratings = [5, 3, 1, 5]
    const reviews = []
    for (let index = 0; index < ratings.length; index += 1) {
      const adopter = await makeUser(`rev-04-adopter-${index}`)
      const adoption = await makeAdoption(
        `rev-04-adoption-${index}`,
        adopter.user.id,
        organization.id,
      )
      reviews.push(
        await addReview(
          adoption.id,
          adopter.user.id,
          ratings[index],
          'ADOPTER_TO_ORGANIZATION',
          null,
          organization.id,
        ),
      )
    }
    await prisma.review.update({
      where: { id: reviews[2].id },
      data: { hiddenAt: new Date() },
    })

    const response = await request(app).get(`/api/organizations/${organization.id}/reputation`)

    expect(response.status).toBe(200)
    expect(response.body.count).toBe(3)
    expect(response.body.average).toBeCloseTo(13 / 3)
    expect(response.body.reviews).toHaveLength(3)
    expect(response.body.reviews.map((review: { id: string }) => review.id)).not.toContain(
      reviews[2].id,
    )
  })

  it('[REV-05] média não é divulgada antes de três avaliações', async () => {
    const user = await makeUser('rev-05-user')
    const organization = await makeOrganization('rev-05-org')
    const firstAdoption = await makeAdoption('rev-05-adoption-a', user.user.id, organization.id)
    const secondAdopter = await makeUser('rev-05-user-b')
    const secondAdoption = await makeAdoption(
      'rev-05-adoption-b',
      secondAdopter.user.id,
      organization.id,
    )
    await addReview(
      firstAdoption.id,
      user.user.id,
      5,
      'ADOPTER_TO_ORGANIZATION',
      null,
      organization.id,
    )
    await addReview(
      secondAdoption.id,
      secondAdopter.user.id,
      1,
      'ADOPTER_TO_ORGANIZATION',
      null,
      organization.id,
    )

    const response = await request(app).get(`/api/organizations/${organization.id}/reputation`)

    expect(response.status).toBe(200)
    expect(response.body.count).toBe(2)
    expect(response.body.average).toBeNull()
  })

  it('[REV-06] avaliação é liberada somente sete dias após a adoção', async () => {
    const adopter = await makeUser('rev-06-adopter')
    const organization = await makeOrganization('rev-06-org')
    const adoption = await makeAdoption(
      'rev-06-adoption',
      adopter.user.id,
      organization.id,
      new Date(Date.now() - 6 * DAY_MS),
    )

    const tooEarly = await request(app)
      .post(`/api/adoptions/${adoption.id}/reviews`)
      .set(adopter.headers)
      .send({ rating: 5 })
    expect(tooEarly.status).toBe(409)

    await prisma.adoption.update({
      where: { id: adoption.id },
      data: { adoptedAt: new Date(Date.now() - 7 * DAY_MS - 1000) },
    })
    const available = await request(app)
      .post(`/api/adoptions/${adoption.id}/reviews`)
      .set(adopter.headers)
      .send({ rating: 5 })
    expect(available.status).toBe(201)
  })

  it('[REV-07] edição expira sete dias após o envio', async () => {
    const adopter = await makeUser('rev-07-adopter')
    const organization = await makeOrganization('rev-07-org')
    const adoption = await makeAdoption('rev-07-adoption', adopter.user.id, organization.id)
    const review = await addReview(
      adoption.id,
      adopter.user.id,
      2,
      'ADOPTER_TO_ORGANIZATION',
      null,
      organization.id,
      new Date(Date.now() - 6 * DAY_MS),
    )

    const withinWindow = await request(app)
      .put(`/api/reviews/${review.id}`)
      .set(adopter.headers)
      .send({ rating: 4, comment: 'Atualizada' })
    expect(withinWindow.status).toBe(200)

    await prisma.review.update({
      where: { id: review.id },
      data: { createdAt: new Date(Date.now() - 8 * DAY_MS) },
    })
    const expired = await request(app)
      .put(`/api/reviews/${review.id}`)
      .set(adopter.headers)
      .send({ rating: 5, comment: 'Tarde demais' })
    expect(expired.status).toBe(409)
  })

  it('[REV-08] comentário é armazenado e retornado como texto literal', async () => {
    const adopter = await makeUser('rev-08-adopter')
    const organization = await makeOrganization('rev-08-org')
    const adoption = await makeAdoption('rev-08-adoption', adopter.user.id, organization.id)
    const comment = '<script>alert(1)</script>'

    const created = await request(app)
      .post(`/api/adoptions/${adoption.id}/reviews`)
      .set(adopter.headers)
      .send({ rating: 5, comment })
    const reputation = await request(app).get(`/api/organizations/${organization.id}/reputation`)

    expect(created.status).toBe(201)
    expect(created.body.comment).toBe(comment)
    expect(reputation.body.reviews[0].comment).toBe(comment)
  })

  it('[REV-09] identidade do avaliador vem da sessão, não do corpo', async () => {
    const adopter = await makeUser('rev-09-adopter')
    const forgedReviewer = await makeUser('rev-09-forged')
    const organization = await makeOrganization('rev-09-org')
    const adoption = await makeAdoption('rev-09-adoption', adopter.user.id, organization.id)

    const response = await request(app)
      .post(`/api/adoptions/${adoption.id}/reviews`)
      .set(adopter.headers)
      .send({ rating: 5, reviewerId: forgedReviewer.user.id })
    const stored = await prisma.review.findUniqueOrThrow({
      where: { adoptionId_direction: { adoptionId: adoption.id, direction: 'ADOPTER_TO_ORGANIZATION' } },
    })

    expect(response.status).toBe(201)
    expect(stored.reviewerId).toBe(adopter.user.id)
    expect(stored.reviewerId).not.toBe(forgedReviewer.user.id)
  })
})
