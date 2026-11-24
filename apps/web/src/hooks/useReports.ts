import { useMutation, useQuery } from '@tanstack/react-query'
import { reportResponseSchema, reportsResponseSchema, type ReportFormData } from '@adotapet/shared'
import { api } from '../lib/api'

interface CreateReportInput {
  report: ReportFormData
  files: File[]
}

export const reportKeys = {
  mine: ['reports', 'mine'] as const,
}

export function useCreateReport() {
  return useMutation({
    mutationFn: async ({ report, files }: CreateReportInput) => {
      const form = new FormData()
      form.set('targetType', report.targetType)
      form.set('targetId', report.targetId)
      form.set('category', report.category)
      form.set('description', report.description)
      for (const file of files) form.append('files', file)
      return reportResponseSchema.parse(await api.post<unknown>('/reports', form))
    },
  })
}

export function useMyReports() {
  return useQuery({
    queryKey: reportKeys.mine,
    queryFn: async ({ signal }) =>
      reportsResponseSchema.parse(await api.get<unknown>('/me/reports', { signal })),
  })
}
