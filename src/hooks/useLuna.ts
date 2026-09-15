import { useQuery } from '@tanstack/react-query';
import { getLunaHealth, getRelatorioTriagens, getTriagens } from '@services/luna.service';
import type { TriagensRelatorioQuery, TriagensListaQuery } from '../types/api';

export function useLunaHealth() {
  return useQuery({
    queryKey: ['luna', 'health'],
    queryFn: getLunaHealth,
    staleTime: 0,
    refetchInterval: 30_000,
    retry: 1,
  });
}

export function useRelatorioTriagens(query: TriagensRelatorioQuery) {
  return useQuery({
    queryKey: ['luna', 'relatorio', query.dataInicio, query.dataFim],
    queryFn: () => getRelatorioTriagens(query),
    staleTime: 60_000,
    enabled: !!query.dataInicio && !!query.dataFim,
  });
}

// LU-09: fila de triagens. queryKey começa com 'luna' de propósito — o
// pull-to-refresh de luna.tsx invalida `{queryKey: ['luna']}` e precisa pegar esta
// query junto do relatório e do health.
export function useTriagens(query: TriagensListaQuery) {
  return useQuery({
    queryKey: [
      'luna',
      'triagens',
      query.dataInicio,
      query.dataFim,
      query.urgencia ?? '',
      query.page ?? 1,
      query.pageSize ?? 20,
    ],
    queryFn: () => getTriagens(query),
    staleTime: 30_000,
    enabled: !!query.dataInicio && !!query.dataFim,
  });
}
