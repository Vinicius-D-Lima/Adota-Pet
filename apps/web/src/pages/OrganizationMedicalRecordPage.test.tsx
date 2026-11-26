import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CompleteMedicalRecord,
  ExamInput,
  HealthConditionInput,
  MedicalRecordResponse,
  VaccinationInput,
} from '@adotapet/shared'
import { petFixture } from '../test/petFixture'
import { renderWithProviders } from '../test/renderWithProviders'
import { completeMedicalRecordFixture } from '../test/fixtures/medicalRecord'
import { OrganizationMedicalRecordPage } from './OrganizationMedicalRecordPage'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

const audit = {
  createdAt: '2026-01-01T10:00:00.000Z',
  createdById: 'demo-organization',
  updatedAt: '2026-01-01T10:00:00.000Z',
  updatedById: 'demo-organization',
}

const uploadResponse = {
  data: [
    {
      id: 'obj-new',
      key: 'medical-exams/exam-new/exame.pdf',
      contentType: 'application/pdf',
      sizeBytes: 3,
      url: '/files/obj-new?token=assinado',
      expiresAt: '2099-01-01T10:00:00.000Z',
    },
  ],
  total: 1,
}

function setup(record: MedicalRecordResponse = completeMedicalRecordFixture, isMember = true) {
  let view = JSON.parse(JSON.stringify(record)) as CompleteMedicalRecord
  mocks.get.mockImplementation((path: string) => {
    const url = String(path)
    if (url.includes('/medical-record')) return Promise.resolve(view)
    if (url.startsWith('/me/organization-pets'))
      return Promise.resolve({
        data: isMember ? [petFixture] : [],
        total: isMember ? 1 : 0,
      })
    return Promise.resolve({})
  })

  mocks.post.mockImplementation(async (path: string, body: unknown) => {
    const url = String(path)
    if (url.endsWith('/vaccinations')) {
      const item = { ...(body as VaccinationInput), id: 'vac-new', ...audit }
      if ('vaccinations' in view) view = { ...view, vaccinations: [item, ...view.vaccinations] }
      return { id: item.id }
    }
    if (url.endsWith('/conditions')) {
      const item = { ...(body as HealthConditionInput), id: 'cond-new', ...audit }
      if ('healthConditions' in view)
        view = { ...view, healthConditions: [item, ...view.healthConditions] }
      return { id: item.id }
    }
    if (url.endsWith('/exams')) {
      const item = { ...(body as ExamInput), id: 'exam-new', attachment: null, ...audit }
      if ('exams' in view) view = { ...view, exams: [item, ...view.exams] }
      return { id: item.id }
    }
    if (url === '/storage/objects') {
      const form = body as FormData
      const examId = String(form.get('resourceId'))
      if ('exams' in view) {
        view = {
          ...view,
          exams: view.exams.map((exam) =>
            exam.id === examId
              ? {
                  ...exam,
                  attachment: {
                    id: 'obj-new',
                    url: '/files/obj-new?token=assinado',
                    expiresAt: '2099-01-01T10:00:00.000Z',
                  },
                }
              : exam,
          ),
        }
      }
      return uploadResponse
    }
    return { id: 'new' }
  })

  mocks.put.mockImplementation(async (path: string, body: unknown) => {
    const [base, itemId] = String(path).split('/').slice(-2)
    if (base === 'vaccinations' && 'vaccinations' in view) {
      view = {
        ...view,
        vaccinations: view.vaccinations.map((item) =>
          item.id === itemId ? { ...item, ...(body as VaccinationInput) } : item,
        ),
      }
    }
    return { id: itemId }
  })

  mocks.delete.mockImplementation(async (path: string) => {
    const [base, itemId] = String(path).split('/').slice(-2)
    if (base === 'vaccinations' && 'vaccinations' in view) {
      view = { ...view, vaccinations: view.vaccinations.filter((item) => item.id !== itemId) }
    }
    return undefined
  })

  return renderWithProviders(
    <Routes>
      <Route
        path="/organizacao/pets/:petId/prontuario"
        element={<OrganizationMedicalRecordPage />}
      />
    </Routes>,
    { route: '/organizacao/pets/luna/prontuario' },
  )
}

const liFor = (text: string) => screen.getByText(text).closest('li') as HTMLElement

describe('OrganizationMedicalRecordPage', () => {
  beforeEach(() => {
    mocks.get.mockReset()
    mocks.post.mockReset()
    mocks.put.mockReset()
    mocks.delete.mockReset()
  })

  it('carrega o prontuário completo com histórico de alterações', async () => {
    setup()
    expect(await screen.findByRole('heading', { name: 'Prontuário do pet' })).toBeInTheDocument()
    expect(screen.getAllByText(/Criado por org-1 em/).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /ver anexo/i })).toHaveAttribute(
      'href',
      '/files/obj-1?token=assinado',
    )
  })

  it('adiciona vacina com datas convertidas para ISO', async () => {
    setup()
    expect(await screen.findByText('V10')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /adicionar vacina/i }))
    const form = screen
      .getByRole('button', { name: /salvar vacina/i })
      .closest('form') as HTMLFormElement
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'V8' } })
    fireEvent.change(within(form).getByLabelText('Data de aplicação'), {
      target: { value: '2026-05-10T10:00' },
    })
    fireEvent.change(within(form).getByLabelText('Próxima dose'), {
      target: { value: '2027-05-10T10:00' },
    })
    fireEvent.click(within(form).getByRole('button', { name: /salvar vacina/i }))

    await waitFor(() => expect(mocks.post).toHaveBeenCalled())
    const [path, body] = mocks.post.mock.calls[0] as [string, VaccinationInput]
    expect(path).toBe('/pets/luna/medical-record/vaccinations')
    expect(body).toMatchObject({ name: 'V8', batch: null, veterinarian: null })
    expect(body.appliedAt).toMatch(/^2026-05-10T/)
    expect(Date.parse(body.nextDoseAt as string)).toBeGreaterThan(Date.parse(body.appliedAt))
    expect(await screen.findByText('V8')).toBeInTheDocument()
  })

  it('rejeita próxima dose anterior à aplicação com mensagem clara', async () => {
    setup()
    await screen.findByText('V10')
    fireEvent.click(screen.getByRole('button', { name: /adicionar vacina/i }))
    const form = screen
      .getByRole('button', { name: /salvar vacina/i })
      .closest('form') as HTMLFormElement
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'V8' } })
    fireEvent.change(within(form).getByLabelText('Data de aplicação'), {
      target: { value: '2026-10-10T10:00' },
    })
    fireEvent.change(within(form).getByLabelText('Próxima dose'), {
      target: { value: '2026-10-01T10:00' },
    })
    fireEvent.click(within(form).getByRole('button', { name: /salvar vacina/i }))

    expect(
      await screen.findByText('A próxima dose não pode ser anterior à data de aplicação.'),
    ).toBeInTheDocument()
    expect(mocks.post).not.toHaveBeenCalled()
  })

  it('edita e remove vacinas existentes', async () => {
    setup()
    expect(await screen.findByText('V10')).toBeInTheDocument()
    const item = liFor('V10')
    fireEvent.click(within(item).getByRole('button', { name: /editar/i }))
    fireEvent.change(within(item).getByLabelText('Nome'), { target: { value: 'V10 atualizada' } })
    fireEvent.click(within(item).getByRole('button', { name: /salvar vacina/i }))

    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith(
        '/pets/luna/medical-record/vaccinations/vac-1',
        expect.objectContaining({ name: 'V10 atualizada' }),
      ),
    )
    const updated = await screen.findByText('V10 atualizada')
    const updatedItem = updated.closest('li') as HTMLElement
    fireEvent.click(within(updatedItem).getByRole('button', { name: /remover/i }))
    await waitFor(() =>
      expect(mocks.delete).toHaveBeenCalledWith('/pets/luna/medical-record/vaccinations/vac-1'),
    )
  })

  it('adiciona condição de saúde com cuidados necessários', async () => {
    setup()
    expect(await screen.findByText('Alergia alimentar')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /adicionar condição/i }))
    const form = screen
      .getByRole('button', { name: /salvar condição/i })
      .closest('form') as HTMLFormElement
    fireEvent.change(within(form).getByLabelText('Nome'), { target: { value: 'Diabetes' } })
    fireEvent.change(within(form).getByLabelText('Tipo'), { target: { value: 'CRONICA' } })
    fireEvent.click(within(form).getByLabelText(/requer cuidados/i))
    fireEvent.click(within(form).getByRole('button', { name: /salvar condição/i }))

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        '/pets/luna/medical-record/conditions',
        expect.objectContaining({ name: 'Diabetes', type: 'CRONICA', careRequired: true }),
      ),
    )
    expect(await screen.findByText('Diabetes')).toBeInTheDocument()
  })

  it('cadastra exame com anexo multipart e mostra o link assinado', async () => {
    setup()
    expect(await screen.findByText('Hemograma')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /adicionar exame/i }))
    const form = screen
      .getByRole('button', { name: /salvar exame/i })
      .closest('form') as HTMLFormElement
    fireEvent.change(within(form).getByLabelText('Tipo de exame'), {
      target: { value: 'Ultrassom' },
    })
    fireEvent.change(within(form).getByLabelText('Data do exame'), {
      target: { value: '2026-06-10T10:00' },
    })
    fireEvent.change(within(form).getByLabelText('Resultado'), {
      target: { value: 'Sem alterações' },
    })
    fireEvent.change(within(form).getByLabelText(/anexo do exame/i), {
      target: { files: [new File(['PDF'], 'exame.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.click(within(form).getByRole('button', { name: /salvar exame/i }))

    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        '/pets/luna/medical-record/exams',
        expect.objectContaining({ type: 'Ultrassom', result: 'Sem alterações' }),
      ),
    )
    const uploadCall = mocks.post.mock.calls.find(([path]) => path === '/storage/objects')
    expect(uploadCall).toBeDefined()
    const formSent = uploadCall?.[1] as FormData
    expect(formSent.get('scope')).toBe('medicalExam')
    expect(formSent.get('resourceId')).toBe('exam-new')
    await waitFor(() =>
      expect(screen.getByText('Ultrassom').closest('li')).toHaveTextContent('Ver anexo'),
    )
  })

  it('salva a castração', async () => {
    setup()
    expect(await screen.findByRole('heading', { level: 2, name: 'Castração' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /salvar castração/i }))
    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith(
        '/pets/luna/medical-record/neutering',
        expect.objectContaining({ done: true }),
      ),
    )
  })

  it('bloqueia quem não é membro da organização do pet', async () => {
    setup(completeMedicalRecordFixture, false)
    expect(
      await screen.findByText(/Somente membros da organização responsável/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /adicionar vacina/i })).not.toBeInTheDocument()
  })
})
