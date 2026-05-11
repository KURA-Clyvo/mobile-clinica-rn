import { useQuery } from '@tanstack/react-query';
import { getPetTimeline } from '@services/pets.service';
import type { TimelineEventResponse } from '../types/api';

export function usePetTimeline(id: number | null) {
  return useQuery({
    queryKey: ['pets', id, 'timeline'],
    queryFn: () => getPetTimeline(id!),
    enabled: id !== null && id > 0,
    staleTime: 30_000,
    select: (data: TimelineEventResponse[]) =>
      [...data].sort(
        (a, b) => new Date(b.dtEvento).getTime() - new Date(a.dtEvento).getTime(),
      ),
  });
}
