import { screen, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MedicalRecordResponse } from '@adotapet/shared'
import { ApiError } from '../lib/ApiError'
import { petFixture } from '../test/petFixture'
import { renderWithProviders } from '../test/renderWithProviders'
import {
  completeMedicalRecordFixture,
  emptyMedicalRecordFixture,
  overdueMedicalRecordFixture,
  publicMedicalRecordFixture,
} from '../test/fixtures/medicalRecord'
import type { Pet } from '../types'
import { PetDetailPage } from './PetDetailPage'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('../lib/api', () => ({ api: { get: mocks.get } }))

const setup = (
  pet: Pet,
  record: MedicalRecordResponse = publicMedicalRecordFixture,
  { isMember = false, forbidden = false } = {},
) => {
  mocks.get.mockImplementation((path: string) => {
    const url = String(path)
    if (url.includes('/medical-record'))
      return forbidden
        ? Promise.reject(new ApiError(403, 'Sem permissão'))
        : Promise.resolve(record)
    if (url.startsWith('/me/favorites')) return Promise.resolve({ data: [], total: 0 })
    if (url.startsWith('/me/requests')) return Promise.resolve({ data: [], total: 0 })
    if (url.startsWith('/me/organization-pets'))
      return Promise.resolve({ data: isMember ? [pet] : [], total: isMember ? 1 : 0 })
    return Promise.resolve(pet)
  })
  return renderWithProviders(
    <Routes>
      <Route path="/pets/:petId" element={<PetDetailPage />} />
    </Routes>,
    { route: `/pets/${pet.id}` },
  )
}

describe('PetDetailPage - saúde do pet', () => {
  beforeEach(() => mocks.get.mockReset())

  it('mostra vacinação e castração derivadas do prontuário', async () => {
    setup({ ...petFixture, vaccinated: false, neutered: false })
    expect(await screen.findByText('Vacinado')).toBeInTheDocument()
    expect(screen.getByText('Castrado')).toBeInTheDocument()
  })

  it('mostra os estados negativos quando o prontuário não registra vacina nem castração', async () => {
    setup(petFixture, emptyMedicalRecordFixture)
    expect(await screen.findByText('Não vacinado')).toBeInTheDocument()
    expect(screen.getByText('Não castrado')).toBeInTheDocument()
  })

  it('destaca vacina com próxima dose vencida', async () => {
    setup(petFixture, overdueMedicalRecordFixture)
    const overdue = await screen.findByText(/Vencida/)
    expect(overdue).toHaveClass('text-coral')
    expect(overdue.closest('li')).toHaveTextContent('Antirábica')
  })

  it('visitante sem vínculo não vê observações nem anexos de exames', async () => {
    setup(petFixture)
    expect(await screen.findByRole('heading', { name: 'Saúde' })).toBeInTheDocument()
    expect(screen.queryByText(/Observação clínica privada/)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /ver exame/i })).not.toBeInTheDocument()
  })

  it('visão completa mostra observações e link assinado do exame', async () => {
    setup(petFixture, completeMedicalRecordFixture)
    expect(await screen.findByText(/Observação clínica privada/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: 'Ver exame' })
    expect(link).toHaveAttribute('href', '/files/obj-1?token=assinado')
    expect(screen.getByText(/Histórico de alterações/)).toBeInTheDocument()
  })

  it('prontuário vazio mostra exatamente a mensagem de estado vazio', async () => {
    setup(petFixture, emptyMedicalRecordFixture)
    const section = await screen.findByRole('region', { name: 'Saúde' })
    expect(within(section).getByText('Ainda não há registros de saúde')).toBeInTheDocument()
  })

  it('mostra "Editar prontuário" apenas para membro da organização', async () => {
    setup(petFixture, completeMedicalRecordFixture, { isMember: true })
    expect(await screen.findByRole('link', { name: /editar prontuário/i })).toHaveAttribute(
      'href',
      `/organizacao/pets/${petFixture.id}/prontuario`,
    )
  })

  it('não mostra edição quando a leitura retorna 403', async () => {
    setup(petFixture, completeMedicalRecordFixture, { isMember: true, forbidden: true })
    expect(await screen.findByRole('heading', { name: 'Saúde' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /editar prontuário/i })).not.toBeInTheDocument()
  })
})
