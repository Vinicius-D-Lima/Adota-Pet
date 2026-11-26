import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { adminPermissions, volunteerPermissions } from '../test/fixtures/organization'
import { renderWithProviders } from '../test/renderWithProviders'
import { Can } from './Can'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() },
}))

const getMock = vi.mocked(api.get)

afterEach(() => vi.clearAllMocks())

describe('<Can>', () => {
  it('libera a ação do ADMIN pela regra manage/all', async () => {
    getMock.mockResolvedValue(adminPermissions)

    renderWithProviders(
      <Can do="update" on="Organization">
        <button>Salvar dados</button>
      </Can>,
    )

    expect(await screen.findByRole('button', { name: 'Salvar dados' })).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith('/me/permissions', undefined)
  })

  it('esconde a ação do voluntário e exibe o fallback', async () => {
    getMock.mockResolvedValue(volunteerPermissions)

    renderWithProviders(
      <Can do="update" on="Organization" fallback={<p>Sem permissão</p>}>
        <button>Salvar dados</button>
      </Can>,
    )

    expect(await screen.findByText('Sem permissão')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Salvar dados' })).not.toBeInTheDocument()
  })

  it('aceita children em função e envia a organização escolhida ao buscar permissões', async () => {
    getMock.mockResolvedValue(volunteerPermissions)

    renderWithProviders(
      <Can do="read" on="Request" organizationId="lar-animal">
        {(allowed) => <p>{allowed ? 'Pode revisar' : 'Não pode revisar'}</p>}
      </Can>,
    )

    expect(await screen.findByText('Pode revisar')).toBeInTheDocument()
    expect(getMock).toHaveBeenCalledWith('/me/permissions', {
      query: { organizationId: 'lar-animal' },
    })
  })
})
