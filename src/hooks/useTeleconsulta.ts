import { useMutation, useQuery } from '@tanstack/react-query';
import { criarOuObterSala, obterSala } from '@services/teleconsulta.service';

export function useTeleconsulta(idAgendamento: number | null) {
  const query = useQuery({
    queryKey: ['teleconsulta', idAgendamento],
    queryFn: () => obterSala(idAgendamento!),
    enabled: idAgendamento !== null && idAgendamento > 0,
    staleTime: 30_000,
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: () => criarOuObterSala(idAgendamento!),
  });

  return { query, mutation };
}
