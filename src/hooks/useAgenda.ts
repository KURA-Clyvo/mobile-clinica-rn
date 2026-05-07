import { useQuery } from '@tanstack/react-query';
import { getAgenda } from '@services/agenda.service';
import { getMondayOf, getSundayOf, formatDateISO } from '@utils/date';

export function useAgendaSemana(semanaBase: Date) {
  const semanaStart = getMondayOf(semanaBase);
  const semanaEnd = getSundayOf(semanaBase);

  const dataInicio = formatDateISO(semanaStart);
  const dataFim = formatDateISO(semanaEnd);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agenda', dataInicio],
    queryFn: () => getAgenda({ dataInicio, dataFim }),
    staleTime: 60_000,
  });

  return { data, isLoading, isError, refetch, semanaStart, semanaEnd };
}
