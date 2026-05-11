import { useQuery } from '@tanstack/react-query';
import { getPetById } from '@services/pets.service';

export function usePetDetail(id: number | null) {
  return useQuery({
    queryKey: ['pets', id],
    queryFn: () => getPetById(id!),
    enabled: id !== null && id > 0,
    staleTime: 120_000,
  });
}
