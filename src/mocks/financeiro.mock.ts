import type { InternalAxiosRequestConfig } from 'axios';
import type { ResumoFinanceiroResponse, PeriodoResumo } from '../types/api';

// FM-07 -- fixture do ÚNICO endpoint de FinanceiroController (GET /resumo). Shape CRU do
// backend (ResumoFinanceiroResponseDto), sem tradução -- mesmo padrão de
// servicos-preco.mock.ts/cobrancas.mock.ts. Regra do repo (TASK-65/FIX_5): imitar o
// CONTRATO do backend, não o shape que a UI produz.
//
// STATELESS, ao contrário de servicos-preco.mock.ts (`_store`): este mock NÃO agrega sobre
// as cobranças lançadas por cobrancas.mock.ts, porque cobrancas.mock.ts::lancar TAMBÉM é
// stateless (não persiste um array de lançamentos -- ver ancoragem daquele arquivo,
// "SIMPLIFICAÇÃO DECLARADA"). Sem um store real de cobranças para agregar, este mock
// devolve uma fixture FIXA por período, com o PERÍODO ECOADO de verdade a partir de
// `config.params` (o próprio contrato exige isso -- ver PeriodoResumoDto, backend @
// 94f558d) e os 4 KPI RECONCILIANDO entre si, exatamente como o backend real garante.
//
// ─── ANCORAGEM DAS REGRAS COPIADAS DO BACKEND ─────────────────────────────
//
// Este mock replica invariantes de negócio que moram em OUTRO REPOSITÓRIO. Cópia
// cross-repo sem âncora é cópia que já divergiu -- só não se sabe quando (regra de ouro v7
// deste projeto). Formato herdado de cobrancas.mock.ts/servicos-preco.mock.ts.
//
// FONTE:   backend-clinica-dotnet
// COMMIT:  94f558d  (`main`)
// CONFERIDO EM: 2026-09-03 (implementador da FM-07)
// REPRODUZIR:
//     git show 94f558d:src/Kura.Api/Controllers/FinanceiroController.cs \
//       | sed -n '9,137p'
//     git show 94f558d:src/Kura.Application/DTOs/Financeiro/ResumoFinanceiroResponseDto.cs
//     git show 94f558d:src/Kura.Application/Validators/ResumoFinanceiroQueryValidator.cs \
//       | sed -n '95,163p'
//     git show 94f558d:src/Kura.Application/Services/FinanceiroService.cs \
//       | sed -n '111,148p;161,194p;259,333p'
//
// As regras replicadas, com a linha de cada uma:
//
//   FinanceiroController.cs:48 -- `[Authorize(Policy = SomenteGestor)]` no CONTROLLER (não
//       no método). Este mock não simula autenticação/perfil -- a checagem de papel é feita
//       pelo HOOK que consome este service (useResumoFinanceiro::enabled), nunca aqui; ver
//       financeiro.service.ts.
//   FinanceiroController.cs:126,136 -- rota única `GET /resumo`, `de`/`ate` obrigatórios
//       (ResumoFinanceiroQueryValidator.cs:125-127, 400 sem eles). Este mock DEFAULTA para
//       "hoje" quando `config.params` vem vazio em vez de rejeitar -- SIMPLIFICAÇÃO
//       DECLARADA (ver "O QUE ESTE MOCK NÃO REPLICA" abaixo), não omissão silenciosa: nenhum
//       caminho de UI chama este mock sem período (useResumoFinanceiro sempre calcula um).
//   FinanceiroService.cs:286-294 (`PeriodoResumo.Criar`) -- intervalo semiaberto
//       `[de 00:00, ate+1d 00:00)`, UTC, sem conversão de fuso: `ate.AddDays(1)` é o limite
//       EXCLUSIVO que faz o último dia contar inteiro. Replicado em `resolverPeriodo()`
//       abaixo com a MESMA aritmética (+1 dia em milissegundos UTC).
//   FinanceiroService.cs:311-315 (`PeriodoResumo.Anterior`) -- período anterior de MESMA
//       duração, imediatamente antes, SEM sobrepor nem um dia (`anterior.FimExclusivoUtc ==
//       periodo.InicioUtc`, contíguos e disjuntos). Replicado em `resolverPeriodo()` como
//       `anteriorFimExclusivoMillis = inicioUtcMillis` (mesmo instante, sem gap).
//   FinanceiroService.cs:131-147 (retorno de `ObterResumoAsync`) -- os 4 KPI saem da MESMA
//       lista, numa resposta só. Este mock não tem uma "lista" real para particionar (ver
//       STATELESS acima), então a reconciliação (soma do mix == receitaBruta, ver
//       ResumoFinanceiroResponseDto.cs:116) é garantida CONSTRUINDO os números da fixture já
//       reconciliados, na mão -- não por cálculo sobre dado dinâmico.
//   ResumoFinanceiroResponseDto.cs:80,106 (`TicketMedio`/`VariacaoPercentual`) +
//   FinanceiroService.cs:170-173,188-194 (`CalcularTicketMedio`/`CalcularVariacaoPercentual`)
//       -- `null`, nunca `0`, quando não há base para calcular. A fixture default
//       (`nrCobrancas > 0`) sempre tem os dois preenchidos; o caso `null` é produzido à parte
//       por `resumoVazio()` (ver função abaixo), usado só quando o app precisa demonstrar o
//       estado "nenhuma cobrança no período" -- NÃO ligado a nenhuma rota especial: é a
//       MESMA fixture teórica que o backend devolveria para um período genuinamente sem
//       lançamento (200, não 404 -- ver doc-comment do controller, `<response code="200">`).
//
// 🔴 O QUE ESTE MOCK DELIBERADAMENTE NÃO REPLICA:
//   1. ResumoFinanceiroQueryValidator.cs:125-162 -- as regras de 400 (`de`/`ate` ausentes,
//      invertidos, fora do calendário representável, duração > 1830 dias). Nenhum caminho de
//      UI deste app monta a query de `de`/`ate` livremente hoje -- useFinanceiro.ts sempre
//      calcula o período (mês corrente), nunca aceita input arbitrário do usuário nesta
//      task. `getResumoFinanceiro()` chamado DIRETO com datas fora do domínio (teste, ou UI
//      futura com seletor de período) tem "sucesso" aqui onde o backend real devolveria 400
//      -- é a direção VISÍVEL da divergência (backend mais restritivo), declarada em vez de
//      replicada para não duplicar o validator inteiro (7 regras) num mock que nenhuma tela
//      aciona com input livre ainda. Candidato a revisitar quando a FM-08 (ou task futura)
//      expuser um seletor de período na UI.
//   2. A agregação de verdade sobre cobranças lançadas em modo mock (ver STATELESS acima) --
//      não há como, sem um store persistido em cobrancas.mock.ts.
//
// 🔴 AS TRÊS DIREÇÕES DE DIVERGÊNCIA (doutrina de cobrancas.mock.ts):
//   backend fica MAIS restritivo  -> o mock aceita, o real recusa (item 1 acima): falha
//        VISÍVEL, mas só fora da demo, e só se uma UI futura permitir período livre.
//   backend fica MENOS restritivo -> não identificada nesta task (não há regra que este mock
//        recuse e o real aceite).
//   MESMA permissividade, VOCABULÁRIO diferente -> não aplicável: este endpoint não tem
//        `code` de erro de negócio (200 é o único caminho de sucesso que este mock produz).
function parseDataOnly(valor: string): { ano: number; mes: number; dia: number } {
  const partes = valor.split('-').map(Number);
  return { ano: partes[0] ?? 1970, mes: partes[1] ?? 1, dia: partes[2] ?? 1 };
}

function formatarDataOnly(utcMillis: number): string {
  return new Date(utcMillis).toISOString().slice(0, 10);
}

// Replica FinanceiroService.cs:118-122: intervalo semiaberto [de 00:00, ate+1d 00:00), UTC,
// sem conversão de fuso -- e o período ANTERIOR, mesma duração, imediatamente antes (sem
// sobrepor nem um dia -- anterior.fimExclusivoUtc == periodo.inicioUtc).
function resolverPeriodo(de: string, ate: string): { periodo: PeriodoResumo; periodoAnterior: PeriodoResumo } {
  const { ano: anoDe, mes: mesDe, dia: diaDe } = parseDataOnly(de);
  const { ano: anoAte, mes: mesAte, dia: diaAte } = parseDataOnly(ate);

  const inicioUtcMillis = Date.UTC(anoDe, mesDe - 1, diaDe, 0, 0, 0, 0);
  const fimExclusivoUtcMillis = Date.UTC(anoAte, mesAte - 1, diaAte + 1, 0, 0, 0, 0);

  const duracaoDias = Math.round((fimExclusivoUtcMillis - inicioUtcMillis) / 86_400_000);

  const anteriorFimExclusivoMillis = inicioUtcMillis; // contíguo, sem gap nem overlap
  const anteriorInicioMillis = inicioUtcMillis - duracaoDias * 86_400_000;
  const anteriorAteMillis = anteriorFimExclusivoMillis - 86_400_000; // último dia, inclusivo

  return {
    periodo: {
      de,
      ate,
      inicioUtc: new Date(inicioUtcMillis).toISOString(),
      fimExclusivoUtc: new Date(fimExclusivoUtcMillis).toISOString(),
    },
    periodoAnterior: {
      de: formatarDataOnly(anteriorInicioMillis),
      ate: formatarDataOnly(anteriorAteMillis),
      inicioUtc: new Date(anteriorInicioMillis).toISOString(),
      fimExclusivoUtc: new Date(anteriorFimExclusivoMillis).toISOString(),
    },
  };
}

// GET /api/v1/financeiro/resumo?de=...&ate=... -- única rota deste mock (ver cabeçalho).
//
// ⚠️ `de`/`ate` vêm por `config.params` (nunca a URL) -- ver ancoragem em
// financeiro.service.ts. `resolveMock` (mock-adapter.ts) casa por regex de `config.url`, que
// não inclui `params` -- ler daqui é o que faz o eco de período funcionar de verdade.
export async function resumo(config: InternalAxiosRequestConfig): Promise<ResumoFinanceiroResponse> {
  const params = (config.params ?? {}) as { de?: string; ate?: string };
  // Defaults para "hoje" -- ver "O QUE ESTE MOCK NÃO REPLICA" no cabeçalho: nenhum caminho
  // de UI chama isto sem período, este fallback é só para não quebrar uma chamada direta
  // sem argumento (teste, ou console).
  const hoje = new Date().toISOString().slice(0, 10);
  const de = params.de ?? hoje;
  const ate = params.ate ?? hoje;

  const { periodo, periodoAnterior } = resolverPeriodo(de, ate);

  // Fixture RECONCILIADA à mão (ver "STATELESS" no cabeçalho): soma do mix ==
  // receitaBruta, exata -- 3000 + 1500.5 + 320 = 4820.5; soma de nrCobrancas do mix ==
  // nrCobrancas -- 5 + 6 + 1 = 12.
  const receitaBruta = 4820.5;
  const nrCobrancas = 12;
  const nrAtendimentosCobrados = 9;
  const receitaBrutaPeriodoAnterior = 3980;
  const nrAtendimentosCobradosPeriodoAnterior = 7;

  return {
    periodo,
    periodoAnterior,
    receitaBruta,
    nrCobrancas,
    nrAtendimentosCobrados,
    // MidpointRounding.AwayFromZero -- mesma regra do backend (FinanceiroService.cs:170-173).
    ticketMedio: Math.round((receitaBruta / nrAtendimentosCobrados) * 100) / 100,
    receitaBrutaPeriodoAnterior,
    nrAtendimentosCobradosPeriodoAnterior,
    variacaoPercentual:
      Math.round(
        ((receitaBruta - receitaBrutaPeriodoAnterior) / receitaBrutaPeriodoAnterior) * 100 * 100,
      ) / 100,
    mixPorServico: [
      { idServicoPreco: 1, nmServico: 'Consulta de rotina', receita: 3000, nrCobrancas: 5 },
      { idServicoPreco: 2, nmServico: 'Vacina V10', receita: 1500.5, nrCobrancas: 6 },
      { idServicoPreco: null, nmServico: '(avulso)', receita: 320, nrCobrancas: 1 },
    ],
  };
}

// Fixture do estado "nenhuma cobrança no período" -- ver §2.4 do brief da FM-07: NÃO usar
// `receitaBruta === 0` para detectar isso (cobrança de cortesia com vlCobrado:0 também
// produz receitaBruta:0, e é um lançamento LEGÍTIMO -- ver cobrancas.mock.ts). O sinal certo
// é `nrCobrancas === 0`. Esta função não é ligada a nenhuma rota -- é fixture só para os
// testes que exercitam o estado vazio no NÍVEL DO HOOK/COMPONENTE (a MESMA função `resumo()`
// acima nunca devolve isto sozinha, porque este mock não tem input do usuário que produza
// "nenhum lançamento" -- ver "O QUE ESTE MOCK NÃO REPLICA" no cabeçalho).
export function resumoVazio(de: string, ate: string): ResumoFinanceiroResponse {
  const { periodo, periodoAnterior } = resolverPeriodo(de, ate);
  return {
    periodo,
    periodoAnterior,
    receitaBruta: 0,
    nrCobrancas: 0,
    nrAtendimentosCobrados: 0,
    ticketMedio: null,
    receitaBrutaPeriodoAnterior: 0,
    nrAtendimentosCobradosPeriodoAnterior: 0,
    variacaoPercentual: null,
    mixPorServico: [],
  };
}
