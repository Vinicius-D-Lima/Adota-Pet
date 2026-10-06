import type { RequestStatus } from '../types'

const CANCELLABLE_STATUSES: readonly RequestStatus[] = ['Enviada', 'Em análise']
const INACTIVE_STATUSES: readonly RequestStatus[] = ['Cancelada', 'Recusada']

/** O mock só aceita cancelar solicitações Enviada ou Em análise. */
export const canCancelRequest = (status: RequestStatus) => CANCELLABLE_STATUSES.includes(status)

export const isActiveRequest = (status: RequestStatus) => !INACTIVE_STATUSES.includes(status)
