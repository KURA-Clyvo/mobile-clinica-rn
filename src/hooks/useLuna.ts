import { useQuery } from '@tanstack/react-query';
import { getLunaHealth, getRelatorioTriagens } from '@services/luna.service';
import type { TriagensRelatorioQuery } from '../types/api';

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
