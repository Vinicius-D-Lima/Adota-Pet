import type { OrganizationRole } from '@adotapet/shared'
import { Mail, UserRound, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Can } from '../components/Can'
import { ConfirmDialog } from '../components/ConfirmDialog'
import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Feedback,
  Field,
  PageIntro,
  PageSurface,
  Select,
  TextLink,
} from '../components/ui'
import {
  useActiveOrganizationId,
  useOrganizationMembers,
  useRemoveOrganizationMember,
  useUpdateOrganizationMember,
  type OrganizationMember,
} from '../hooks/useOrganization'
import { ApiError } from '../lib/ApiError'

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback

interface PendingRole {
  member: OrganizationMember
  role: OrganizationRole
}

export function OrganizationMembersPage() {
  const organizationId = useActiveOrganizationId()
  const membersQuery = useOrganizationMembers(organizationId)
  const updateMember = useUpdateOrganizationMember(organizationId)
  const removeMember = useRemoveOrganizationMember(organizationId)
  const [pendingRole, setPendingRole] = useState<PendingRole | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<OrganizationMember | null>(null)
  const [error, setError] = useState<{ organizationId: string; message: string } | null>(null)
  const shownError = error?.organizationId === organizationId ? error.message : ''

  if (membersQuery.isPending) return <Feedback>Carregando membros...</Feedback>
  if (membersQuery.isError) {
    return <Feedback error>Não foi possível carregar os membros da organização.</Feedback>
  }

  const members = membersQuery.data

  const confirmRole = async () => {
    if (!pendingRole) return
    setError(null)
    try {
      await updateMember.mutateAsync({ userId: pendingRole.member.userId, role: pendingRole.role })
      setPendingRole(null)
    } catch (cause) {
      setError({
        organizationId,
        message: errorMessage(cause, 'Não foi possível alterar o papel deste membro.'),
      })
    }
  }

  const confirmRemoval = async () => {
    if (!pendingRemoval) return
    setError(null)
    try {
      await removeMember.mutateAsync(pendingRemoval.userId)
      setPendingRemoval(null)
    } catch (cause) {
      setError({
        organizationId,
        message: errorMessage(cause, 'Não foi possível remover este membro.'),
      })
    }
  }

  return (
    <PageSurface>
      <Container as="section" className="pb-24 pt-10 md:pt-14">
        <PageIntro
          eyebrow="Área da organização"
          title="Membros"
          description="Veja quem atua na instituição e gerencie os papéis de acesso."
          action={
            <Can do="update" on="Member" organizationId={organizationId}>
              <TextLink to="/organizacao/convites">Convidar pessoas →</TextLink>
            </Can>
          }
        />

        {shownError && !pendingRole && !pendingRemoval && <Alert>{shownError}</Alert>}

        <Card className="divide-y divide-line p-0">
          {members.length === 0 ? (
            <p className="m-0 p-6 text-sm text-muted">Nenhum membro ativo encontrado.</p>
          ) : (
            members.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-forest-100 text-forest-800">
                    <UserRound size={20} />
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm">{member.name}</strong>
                    <small className="flex items-center gap-1.5 text-muted">
                      <Mail size={13} /> {member.email}
                    </small>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge tone={member.role === 'ADMIN' ? 'approved' : 'review'}>
                    {member.role === 'ADMIN' ? 'Administrador' : 'Voluntário'}
                  </Badge>
                  <Can do="update" on="Member" organizationId={organizationId}>
                    <div className="w-[150px]">
                      <Field label="Papel" tight>
                        <Select
                          aria-label={`Papel de ${member.name}`}
                          value={member.role}
                          onChange={(event) =>
                            setPendingRole({
                              member,
                              role: event.target.value as OrganizationRole,
                            })
                          }
                        >
                          <option value="ADMIN">Administrador</option>
                          <option value="VOLUNTEER">Voluntário</option>
                        </Select>
                      </Field>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => setPendingRemoval(member)}
                      disabled={removeMember.isPending || updateMember.isPending}
                    >
                      Remover
                    </Button>
                  </Can>
                </div>
              </div>
            ))
          )}
        </Card>

        <p className="mt-5 text-xs text-muted">
          <UsersRound size={14} className="mr-1 inline" />A organização precisa manter ao menos um
          administrador ativo.
        </p>
      </Container>

      {pendingRole && (
        <ConfirmDialog
          title="Alterar papel?"
          description={`${pendingRole.member.name} passará a ser ${
            pendingRole.role === 'ADMIN' ? 'administrador' : 'voluntário'
          }.`}
          confirmLabel="Alterar papel"
          confirmVariant="primary"
          busy={updateMember.isPending}
          onConfirm={() => void confirmRole()}
          onClose={() => {
            setPendingRole(null)
            setError(null)
          }}
        >
          {shownError && <Alert>{shownError}</Alert>}
        </ConfirmDialog>
      )}

      {pendingRemoval && (
        <ConfirmDialog
          title="Remover membro?"
          description={`${pendingRemoval.name} deixará de ter acesso a esta organização.`}
          confirmLabel="Remover membro"
          busy={removeMember.isPending}
          onConfirm={() => void confirmRemoval()}
          onClose={() => {
            setPendingRemoval(null)
            setError(null)
          }}
        >
          {shownError && <Alert>{shownError}</Alert>}
        </ConfirmDialog>
      )}
    </PageSurface>
  )
}
