import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAgenda,
  atualizarStatusAgendamento,
  type AtualizarStatusAgendamentoRequest,
} from '@services/agenda.service';
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

// FM-04: `onSettled` (não só `onSuccess`) invalida a agenda tanto no sucesso
// quanto no erro — inclusive no 409 (conflito de concorrência otimista): a
// tela precisa reler o agendamento com o nrVersion atual de qualquer jeito,
// senão o próximo toque do usuário repete o mesmo nrVersion velho e recebe
// 409 de novo, em loop. `invalidateQueries({queryKey:['agenda']})` invalida
// por prefixo (React Query) — cobre a chave `['agenda', dataInicio]` de
// QUALQUER semana já cacheada, não só a atual.
export function useAtualizarStatusAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { idAgendamento: number } & AtualizarStatusAgendamentoRequest) =>
      atualizarStatusAgendamento(vars.idAgendamento, {
        dsStatus: vars.dsStatus,
        nrVersion: vars.nrVersion,
        dsObservacao: vars.dsObservacao,
      }),
    retry: 0,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['agenda'] });
    },
  });
}
