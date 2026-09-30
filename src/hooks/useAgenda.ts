import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getAgenda,
  atualizarStatusAgendamento,
  checkinAgendamento,
  iniciarAtendimento,
  type AtualizarStatusAgendamentoRequest,
  type CheckinAgendamentoRequest,
  type IniciarAtendimentoRequest,
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

// REC-12 — modo "Hoje" da agenda (R1). `dataInicio = dataFim =
// formatDateISO(new Date())`: `formatDateISO` usa getFullYear/getMonth/
// getDate LOCAIS (nunca `toISOString()`, que fixa o dia em UTC e erra a
// partir das ~21h BRT — m-1 de g2-rec08.md). Query key `['agenda', 'hoje',
// dataHoje]`: MESMO prefixo `'agenda'` que useAgendaSemana usa, para que
// `invalidateQueries({queryKey:['agenda']})` (useAtualizarStatusAgendamento/
// useCheckinAgendamento abaixo) invalide as duas visões sem precisar
// duplicar a chamada de invalidate em dois lugares.
export function useAgendaHoje() {
  const dataHoje = formatDateISO(new Date());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['agenda', 'hoje', dataHoje],
    queryFn: () => getAgenda({ dataInicio: dataHoje, dataFim: dataHoje }),
    staleTime: 30_000,
    // Fix wave G2 (I-1): "Hoje" é a única visão que a recepção deixa aberta
    // o dia todo — pega check-in feito em OUTRO aparelho e a mudança de
    // etapa que outro atendimento causa, sem depender de o operador puxar
    // pra atualizar. Mesmo precedente de `useLuna.ts:10` (30s); aqui 60s —
    // a query já tem `staleTime: 30_000` por cima, então 60s é o menor
    // intervalo que não briga com o cache. NÃO aplicado a `useAgendaSemana`
    // (ruling do maestro) — a visão Semana não precisa da mesma urgência.
    refetchInterval: 60_000,
  });

  return { data, isLoading, isError, refetch, dataHoje };
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

// REC-12 — "Chegou" (check-in). Mesmo racional de `onSettled` da mutação
// acima: 409 (versão desatualizada) e 422 (status não elegível) precisam
// recarregar a linha de qualquer jeito, nunca deixar a UI presa num estado
// que já divergiu do servidor. m-7 (g2-rec09.md): a resposta do POST não
// tem foto/urgência — por isso esta mutação também NUNCA usa o valor de
// retorno como estado da lista, só dispara invalidate e deixa o refetch
// trazer a linha completa (mesmo tratamento de useAtualizarStatusAgendamento).
export function useCheckinAgendamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { idAgendamento: number } & CheckinAgendamentoRequest) =>
      checkinAgendamento(vars.idAgendamento, { nrVersion: vars.nrVersion }),
    retry: 0,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['agenda'] });
    },
  });
}

// REC-13 — início de atendimento (tela de prontuário, chamado uma vez ao
// montar). Mesmo racional de `onSettled` de useCheckinAgendamento acima: o
// caller (consulta/[idPet].tsx) trata o erro como aviso não-bloqueante
// (nunca impede o vet de atender), então invalidar SEMPRE — sucesso ou
// falha — garante que, se outro caminho (ex.: check-in feito à parte)
// alterou o `nrVersion` nesse meio-tempo, a agenda relida traz o estado
// real assim que o usuário voltar pra ela.
export function useIniciarAtendimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { idAgendamento: number } & IniciarAtendimentoRequest) =>
      iniciarAtendimento(vars.idAgendamento, { nrVersion: vars.nrVersion }),
    retry: 0,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['agenda'] });
    },
  });
}
