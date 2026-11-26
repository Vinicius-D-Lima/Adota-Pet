import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { ApiError } from '../lib/ApiError'
import { adminPermissions, organizationMembers } from '../test/fixtures/organization'
import { renderWithProviders } from '../test/renderWithProviders'
import { OrganizationMembersPage } from './OrganizationMembersPage'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

const getMock = vi.mocked(api.get)
const patchMock = vi.mocked(api.patch)
const deleteMock = vi.mocked(api.delete)
const membersPath = '/organizations/demo-organization/members'

beforeEach(() => {
  sessionStorage.clear()
  getMock.mockImplementation((path: string) => {
    if (String(path).startsWith('/me/permissions')) return Promise.resolve(adminPermissions)
    if (String(path) === membersPath)
      return Promise.resolve({ data: organizationMembers, total: organizationMembers.length })
    return Promise.resolve({ data: [], total: 0 })
  })
})

afterEach(() => vi.clearAllMocks())

describe('OrganizationMembersPage - ADMIN', () => {
  it('mostra nome, e-mail e papel de cada membro com ações de gestão', async () => {
    renderWithProviders(<OrganizationMembersPage />)

    expect(await screen.findByText('Mariana Souza')).toBeInTheDocument()
    expect(screen.getByText('mariana@adotapet.local')).toBeInTheDocument()
    expect(await screen.findByRole('combobox', { name: 'Papel de Mariana Souza' })).toHaveValue(
      'VOLUNTEER',
    )
    expect(await screen.findAllByRole('button', { name: 'Remover' })).toHaveLength(2)
  })

  it('confirma a alteração de papel antes de chamar a API', async () => {
    patchMock.mockResolvedValue({ ...organizationMembers[1], role: 'ADMIN' })
    const user = userEvent.setup()
    renderWithProviders(<OrganizationMembersPage />)

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Papel de Mariana Souza' }),
      'ADMIN',
    )
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(patchMock).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Alterar papel' }))
    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith(`${membersPath}/mariana`, { role: 'ADMIN' }),
    )
  })

  it('confirma a remoção antes de chamar a API', async () => {
    deleteMock.mockResolvedValue(undefined)
    const user = userEvent.setup()
    renderWithProviders(<OrganizationMembersPage />)

    await user.click((await screen.findAllByRole('button', { name: 'Remover' }))[1])
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remover membro' }))

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(`${membersPath}/mariana`))
  })

  it('exibe a mensagem amigável do 409 ao tentar remover o último ADMIN', async () => {
    deleteMock.mockRejectedValue(
      new ApiError(409, 'A organização precisa manter ao menos um ADMIN'),
    )
    const user = userEvent.setup()
    renderWithProviders(<OrganizationMembersPage />)

    await user.click((await screen.findAllByRole('button', { name: 'Remover' }))[0])
    await user.click(screen.getByRole('button', { name: 'Remover membro' }))

    expect(
      await screen.findByText('A organização precisa manter ao menos um ADMIN'),
    ).toBeInTheDocument()
  })
})
