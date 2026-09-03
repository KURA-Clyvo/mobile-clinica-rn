import { useQuery } from '@tanstack/react-query';
import { getResumoFinanceiro } from '@services/financeiro.service';
import { useIsGestor } from './useIsGestor';

// FM-07 (ciclo FIN) — hook do resumo financeiro. `FinanceiroController` (backend @ 94f558d)
// tem `[Authorize(Policy = SomenteGestor)]` no CONTROLLER: um VETERINARIO puro recebe `403`.
//
// 🔴 A ARMADILHA CENTRAL DESTA TASK: renderizar condicionalmente NÃO BASTA. O React Query
// dispara `queryFn` quando o hook é MONTADO, independente de o JSX que consome `data`
// renderizar ou não — então um `dashboard.tsx` que só escondesse o card no JSX ainda assim
// disparia a chamada para todo veterinário que abrisse a tela inicial. `enabled: isGestor`
// é o que de fato IMPEDE a chamada; o gate de render em dashboard.tsx (ver comentário lá) é
// a SEGUNDA metade, para não deixar um card vazio na árvore.
//
// Prova (mordida obrigatória do brief): tests/fm07-veterinario-sem-chamada-financeiro.test.tsx
// monta DashboardScreen como VETERINARIO com a cadeia REAL (sem jest.mock deste hook nem do
// service) e prova que `apiClient.get` nunca é chamado com a URL de financeiro/resumo.
export function useResumoFinanceiro(de: string, ate: string) {
  const isGestor = useIsGestor();
  const { data, isLoading, isError, refetch } = useQuery({
    // `de`/`ate` na queryKey (regra do repo, ver useServicosPreco.ts::incluirInativos): sem
    // isso, trocar o período devolveria o cache de OUTRO período e o número ficaria errado
    // sem erro nenhum.
    queryKey: ['financeiro', 'resumo', de, ate],
    queryFn: () => getResumoFinanceiro(de, ate),
    enabled: isGestor,
    staleTime: 30_000,
  });
  return { data, isLoading, isError, refetch, isGestor };
}
