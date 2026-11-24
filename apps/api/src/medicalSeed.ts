export interface LegacyPetHealth {
  id: string
  createdAt: string
  vaccinated?: unknown
  neutered?: unknown
  specialCare?: unknown
}

/** Conversão única usada pelo seed e testada por PRO-08. */
export function medicalRecordDataFromLegacyPet(pet: LegacyPetHealth) {
  const appliedAt = new Date(pet.createdAt)
  return {
    vaccinations:
      pet.vaccinated === true ? [{ name: 'Vacinação em dia', appliedAt, nextDoseAt: null }] : [],
    neutering: {
      done: pet.neutered === true,
      date: pet.neutered === true ? appliedAt : null,
    },
    healthConditions:
      pet.specialCare === true
        ? [
            {
              name: 'Cuidados especiais informados',
              type: 'CRONICA' as const,
              notes: 'Importado do cadastro anterior do pet.',
              careRequired: true,
            },
          ]
        : [],
  }
}
