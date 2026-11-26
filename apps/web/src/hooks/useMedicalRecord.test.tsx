import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/ApiError'
import { TestProviders } from '../test/renderWithProviders'
import { completeMedicalRecordFixture } from '../test/fixtures/medicalRecord'
import {
  isMedicalRecordForbidden,
  useMedicalRecord,
  useMedicalRecordMutations,
} from './useMedicalRecord'

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() }))
vi.mock('../lib/api', () => ({ api: mocks }))

const wrapper = TestProviders

describe('useMedicalRecord', () => {
  beforeEach(() => {
    mocks.get.mockReset()
    mocks.post.mockReset()
    mocks.put.mockReset()
    mocks.delete.mockReset()
  })

  it('busca e valida a resposta completa do prontuário', async () => {
    mocks.get.mockResolvedValue(completeMedicalRecordFixture)
    const { result } = renderHook(() => useMedicalRecord('luna'), { wrapper })

    await waitFor(() => expect(result.current.data).toEqual(completeMedicalRecordFixture))
    expect(mocks.get).toHaveBeenCalledWith('/pets/luna/medical-record', expect.any(Object))
  })

  it('reconhece 403 como ausência de permissão', async () => {
    mocks.get.mockRejectedValue(new ApiError(403, 'Sem permissão'))
    const { result } = renderHook(() => useMedicalRecord('luna'), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(isMedicalRecordForbidden(result.current.error)).toBe(true)
  })

  it('cria, atualiza e remove itens pelos endpoints do prontuário', async () => {
    mocks.post.mockResolvedValue({ id: 'vac-new' })
    mocks.put.mockResolvedValue({ id: 'vac-1' })
    mocks.delete.mockResolvedValue(undefined)
    const { result } = renderHook(() => useMedicalRecordMutations(), { wrapper })
    const data = {
      name: 'V10',
      appliedAt: '2026-01-01T10:00:00.000Z',
      nextDoseAt: '2099-01-01T10:00:00.000Z',
      batch: null,
      veterinarian: null,
    }

    await act(async () => {
      await result.current.saveVaccination.mutateAsync({ petId: 'luna', data })
    })
    await act(async () => {
      await result.current.saveVaccination.mutateAsync({
        petId: 'luna',
        data,
        itemId: 'vac-1',
      })
    })
    await act(async () => {
      await result.current.removeItem.mutateAsync({
        petId: 'luna',
        kind: 'vaccinations',
        itemId: 'vac-1',
      })
    })

    expect(mocks.post).toHaveBeenCalledWith('/pets/luna/medical-record/vaccinations', data)
    expect(mocks.put).toHaveBeenCalledWith('/pets/luna/medical-record/vaccinations/vac-1', data)
    expect(mocks.delete).toHaveBeenCalledWith('/pets/luna/medical-record/vaccinations/vac-1')
  })

  it('envia o anexo do exame como multipart com os metadados exigidos', async () => {
    mocks.post.mockResolvedValue({
      data: [
        {
          id: 'obj-1',
          key: 'medical-exams/exam-1/exame.pdf',
          contentType: 'application/pdf',
          sizeBytes: 4,
          url: '/files/obj-1?token=assinado',
          expiresAt: '2099-01-01T10:00:00.000Z',
        },
      ],
      total: 1,
    })
    const { result } = renderHook(() => useMedicalRecordMutations(), { wrapper })
    const file = new File(['PDF'], 'exame.pdf', { type: 'application/pdf' })

    await act(async () => {
      await result.current.uploadAttachment.mutateAsync({
        petId: 'luna',
        examId: 'exam-1',
        file,
      })
    })

    const [path, body] = mocks.post.mock.calls[0] as [string, FormData]
    expect(path).toBe('/storage/objects')
    expect(body).toBeInstanceOf(FormData)
    expect(body.get('scope')).toBe('medicalExam')
    expect(body.get('resourceType')).toBe('MEDICAL_EXAM')
    expect(body.get('resourceId')).toBe('exam-1')
    expect(body.get('files')).toBeInstanceOf(File)
  })
})
