import { useQuery } from '@tanstack/react-query'
import { getPets } from '../services/localApi'

export function usePets() {
  return useQuery({
    queryKey: ['pets'],
    queryFn: getPets,
  })
}
