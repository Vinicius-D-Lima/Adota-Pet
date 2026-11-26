import type { CompleteMedicalRecord, PublicMedicalRecord } from '@adotapet/shared'

const audit = {
  createdAt: '2026-01-10T10:00:00.000Z',
  createdById: 'org-1',
  updatedAt: '2026-02-10T10:00:00.000Z',
  updatedById: 'org-2',
}

/** Prontuário completo: vacinas em dia, condição com observação e exame anexado. */
export const completeMedicalRecordFixture: CompleteMedicalRecord = {
  petId: 'luna',
  complete: true,
  vaccinated: true,
  neutered: true,
  specialCare: true,
  neutering: { done: true, date: '2025-06-01T10:00:00.000Z', ...audit },
  vaccinations: [
    {
      id: 'vac-1',
      name: 'V10',
      appliedAt: '2025-04-01T10:00:00.000Z',
      nextDoseAt: '2099-04-01T10:00:00.000Z',
      batch: 'LOTE-10',
      veterinarian: 'Dra. Ana',
      ...audit,
    },
  ],
  healthConditions: [
    {
      id: 'cond-1',
      name: 'Alergia alimentar',
      type: 'EM_TRATAMENTO',
      careRequired: true,
      notes: 'Observação clínica privada',
      ...audit,
    },
  ],
  exams: [
    {
      id: 'exam-1',
      type: 'Hemograma',
      date: '2026-02-01T10:00:00.000Z',
      result: 'Sem alterações',
      attachment: {
        id: 'obj-1',
        url: '/files/obj-1?token=assinado',
        expiresAt: '2099-03-01T10:00:00.000Z',
      },
      ...audit,
    },
  ],
}

/** Visão pública: o backend omite exames, observações e campos de auditoria. */
export const publicMedicalRecordFixture: PublicMedicalRecord = {
  petId: 'luna',
  vaccinated: true,
  neutered: true,
  specialCare: true,
  neutering: { done: true, date: '2025-06-01T10:00:00.000Z' },
  vaccinations: [
    {
      id: 'vac-1',
      name: 'V10',
      appliedAt: '2025-04-01T10:00:00.000Z',
      nextDoseAt: '2099-04-01T10:00:00.000Z',
      batch: 'LOTE-10',
      veterinarian: 'Dra. Ana',
    },
  ],
  healthConditions: [
    {
      id: 'cond-1',
      name: 'Alergia alimentar',
      type: 'EM_TRATAMENTO',
      careRequired: true,
    },
  ],
}

export const overdueMedicalRecordFixture: PublicMedicalRecord = {
  ...publicMedicalRecordFixture,
  vaccinated: false,
  vaccinations: [
    {
      id: 'vac-vencida',
      name: 'Antirábica',
      appliedAt: '2020-01-10T10:00:00.000Z',
      nextDoseAt: '2020-01-10T10:00:00.000Z',
      batch: null,
      veterinarian: null,
    },
  ],
}

export const emptyMedicalRecordFixture: PublicMedicalRecord = {
  petId: 'luna',
  vaccinated: false,
  neutered: false,
  specialCare: false,
  neutering: { done: false, date: null },
  vaccinations: [],
  healthConditions: [],
}
