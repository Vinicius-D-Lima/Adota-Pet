import type { Profile } from './index.js'

declare const completeProfile: Profile
const profileWithoutCpf: Omit<Profile, 'cpf'> = completeProfile

/**
 * MONO-04: se `cpf` deixar de ser obrigatório no contrato compartilhado, este
 * `@ts-expect-error` fica sem erro e o typecheck do pacote falha.
 */
// @ts-expect-error MONO-04 - um perfil sem CPF não pode satisfazer o contrato
export const mono04StaleProfile: Profile = profileWithoutCpf
