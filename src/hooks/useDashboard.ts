import { useQuery } from '@tanstack/react-query';
import { getHoje, getAlertas, getRecentes } from '@services/dashboard.service';

export function useDashboardHoje() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'hoje'],
    queryFn: getHoje,
    staleTime: 30_000,
  });
  return { data, isLoading, isError, refetch };
}

export function useAlertas() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'alertas'],
    queryFn: getAlertas,
    staleTime: 10_000,
  });
  return { data, isLoading, isError, refetch };
}

export function useRecentes() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['dashboard', 'recentes'],
    queryFn: getRecentes,
    staleTime: 30_000,
  });
  return { data, isLoading, isError, refetch };
}
