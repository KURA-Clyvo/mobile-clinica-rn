import { apiClient } from './api/client';
import type { ResumoFinanceiroResponse } from '../types/api';

// FM-07 (ciclo FIN) — service NOVO, 1:1 com FinanceiroController (backend-clinica-dotnet
// @ 94f558d). UM endpoint só, de propósito: os 4 KPI (receita bruta, ticket médio, mix por
// serviço, comparação com o período anterior) saem da MESMA lista de cobranças, na MESMA
// resposta — quatro chamadas separadas sobre "o mesmo" período seriam quatro leituras em
// quatro instantes, e uma cobrança lançada no meio faria os cards discordarem entre si sem
// que nenhum estivesse errado isoladamente (doc-comment do controller, FinanceiroController.cs
// :10-17). A FM-08 consome a MESMA resposta (mixPorServico/periodoAnterior) — não duplicar a
// chamada.
//
// 🔴 `[Authorize(Policy = SomenteGestor)]` está no CONTROLLER (:48) — o backend já barra quem
// não é GESTOR com 403. Este service NÃO duplica a checagem; quem faz isso é o HOOK que o
// consome (`useResumoFinanceiro`, ver useFinanceiro.ts) via `enabled: isGestor` — sem isso, um
// VETERINARIO que abrisse o dashboard dispararia um 403 na tela inicial.
//
// 🔴 `de`/`ate` são OBRIGATÓRIOS (400 sem eles, ResumoFinanceiroQueryValidator.cs:125-127) —
// este service não tem overload/default de período de propósito, para não "esquecer" o
// parâmetro por engano e receber 200 com números plausíveis de outro período (razão
// documentada em ResumoFinanceiroQueryValidator.cs, comentário de cabeçalho).
//
// ⚠️ `de`/`ate` vão por `params` (nunca concatenados na URL) — ver mock-adapter.ts:
// `resolveMock` casa por regex de `config.url`, que NÃO inclui `params`; concatenar faria a
// âncora `$` da rota parar de casar e o mock nunca disparar, em silêncio.
export async function getResumoFinanceiro(
  de: string,
  ate: string,
): Promise<ResumoFinanceiroResponse> {
  const { data } = await apiClient.get<ResumoFinanceiroResponse>('/api/v1/financeiro/resumo', {
    params: { de, ate },
  });
  return data;
}
