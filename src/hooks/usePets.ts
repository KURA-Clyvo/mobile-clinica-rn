import { useQuery } from '@tanstack/react-query';
import { listPets } from '@services/pets.service';

export function usePets(filtro?: string) {
  return useQuery({
    queryKey: ['pets', { filtro: filtro ?? '' }],
    queryFn: () => listPets(filtro),
    staleTime: 60_000,
  });
}
