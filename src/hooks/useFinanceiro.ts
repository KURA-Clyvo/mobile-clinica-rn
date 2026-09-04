import { useCallback } from 'react';
import { useQuery, type QueryObserverResult } from '@tanstack/react-query';
import { getResumoFinanceiro } from '@services/financeiro.service';
import type { ResumoFinanceiroResponse } from '../types/api';
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
//
// 🔴 I-1 da G2 da FM-08: `isFetching` é exposto AO LADO de `isLoading`, não no lugar dele.
// `@tanstack/react-query` 5.100.10 define `isLoading = isPending && isFetching` (ver
// `query-core/build/modern/queryObserver.js:310`) -- depois da 1ª carga bem-sucedida,
// `isPending` fica `false` para sempre, então `isLoading` NUNCA mais volta a `true` num
// refetch, mesmo com fetch em voo. `isFetching` continua `true` durante QUALQUER busca,
// inicial ou refetch -- é o sinal certo para pull-to-refresh (`RefreshControl.refreshing`);
// `isLoading` continua certo para o skeleton de PRIMEIRA carga (não quer "piscar" skeleton
// a cada refetch). Consumidor único hoje é financeiro/index.tsx -- dashboard.tsx usa
// `isLoading: loadingFinanceiro` (skeleton do card) e tem seu PRÓPRIO `refreshing` via
// `useState`+`Promise.all` (não lê nada deste hook para o gesto de refresh), então expor
// este campo novo não muda o comportamento dele (conferido: `grep -rn
// "useResumoFinanceiro" src/ tests/` -- só os dois consumidores citados).
export function useResumoFinanceiro(de: string, ate: string) {
  const isGestor = useIsGestor();
  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    // `de`/`ate` na queryKey (regra do repo, ver useServicosPreco.ts::incluirInativos): sem
    // isso, trocar o período devolveria o cache de OUTRO período e o número ficaria errado
    // sem erro nenhum.
    queryKey: ['financeiro', 'resumo', de, ate],
    queryFn: () => getResumoFinanceiro(de, ate),
    enabled: isGestor,
    staleTime: 30_000,
  });

  // FM-09 (item 4) — `refetch()` do React Query BYPASSA `enabled`. Medido na fonte do
  // @tanstack/query-core instalado (5.100.10): `refetch` -> `Query#fetch()` ->
  // `#executeFetch`, nenhum dos três consulta `enabled` — só o `fetch()` AUTOMÁTICO de
  // montagem/mudança de dependência do observer olha `enabled`. Até esta task a guarda
  // vivia em cada CALL SITE: `dashboard.tsx` espalhava `refetch` incondicional no
  // `Promise.all` de pull-to-refresh e precisava de `...(isGestor ? [refetchFinanceiro()]
  // : [])` para não disparar a chamada para um VETERINARIO; `financeiro/index.tsx` não
  // tinha guarda nenhuma (não precisava — `useRequireGestor()` ali renderiza `null` ANTES
  // de montar o `RefreshControl`, medido: VETERINARIO monta 0 `RefreshControl`, GESTOR
  // monta 1 — não contradizer essa medição sem remedir). Embrulhar aqui torna o bypass
  // IMPOSSÍVEL por call site, em vez de depender de cada consumidor lembrar de guardar.
  const refetchSeGestor = useCallback((): Promise<QueryObserverResult<ResumoFinanceiroResponse, Error> | undefined> => {
    if (!isGestor) return Promise.resolve(undefined);
    return refetch();
  }, [isGestor, refetch]);

  return { data, isLoading, isFetching, isError, refetch: refetchSeGestor, isGestor };
}
