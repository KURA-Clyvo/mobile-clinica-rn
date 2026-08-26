import type { InternalAxiosRequestConfig } from 'axios';
import * as authMock from '../../mocks/auth.mock';
import * as dashboardMock from '../../mocks/dashboard.mock';
import * as agendaMock from '../../mocks/agenda.mock';
import * as petsMock from '../../mocks/pets.mock';
import * as eventosMock from '../../mocks/eventos-clinicos.mock';
import * as lunaMock from '../../mocks/luna.mock';
import * as teleconsultaMock from '../../mocks/teleconsulta.mock';

type MockHandler = (config: InternalAxiosRequestConfig) => Promise<unknown>;

const ROUTES: [RegExp, MockHandler][] = [
  [/\/auth\/login$/, authMock.login],
  [/\/auth\/register-clinica$/, authMock.register],
  [/\/agenda$/, agendaMock.agenda],
  [/\/dashboard\/hoje$/, dashboardMock.hoje],
  [/\/dashboard\/alertas$/, dashboardMock.alertas],
  [/\/dashboard\/recentes$/, dashboardMock.recentes],
  [/\/pets\/\d+\/timeline$/, petsMock.timeline],
  [/\/pets\/\d+$/, petsMock.byId],
  [/\/pets$/, petsMock.list],
  [/\/eventos-clinicos\/consultas$/, eventosMock.criarConsulta],
  [/\/eventos-clinicos\/prescricoes$/, eventosMock.criarPrescricao],
  [/\/eventos-clinicos\/\d+\/transcricao$/, eventosMock.enviarTranscricao],
  [/\/eventos-clinicos\/\d+\/soap$/, eventosMock.confirmarSoap],
  [/\/eventos-clinicos\/\d+\/receituario$/, eventosMock.gerarReceituario],
  [/\/medicamentos$/, eventosMock.medicamentos],
  [/\/whatsapp\/enviar$/, lunaMock.enviarWhatsApp],
  [/\/ready$/, lunaMock.ready],
  [/\/luna\/triagens\/relatorio$/, lunaMock.relatorioTriagens],
  // TASK-71 (FIX_6): criarOuObterSala (POST) e obterSala (GET) batem no mesmo
  // endpoint — o handler despacha por config.method (ver teleconsulta.mock.ts::sala).
  [/\/teleconsulta\/\d+\/sala$/, teleconsultaMock.sala],
];

const MOCK_LATENCY_MS = 300;

// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — item 5: sem isto não há
// como provar visualmente o trabalho da task, porque em modo mock TODAS as
// telas têm dado, e o estado vazio (item 1) nunca aparece na demonstração.
// Ponto único de estrangulamento (`resolveMock`, as 21 rotas passam por
// aqui) — NENHUM arquivo de `src/mocks/` é tocado; cada entrada abaixo
// mapeia o mesmo padrão de URL usado em `ROUTES` acima para uma função que
// esvazia especificamente o formato que aquele endpoint devolve (array
// plano na maioria, objeto com campo aninhado no caso de `/agenda`).
//
// Lida DENTRO da função (nunca cacheada em `const` de módulo) de propósito:
// um teste que queira ligar a flag só precisa setar
// `process.env.EXPO_PUBLIC_MOCK_EMPTY = 'true'` antes de chamar
// `resolveMock()`, sem precisar de `jest.resetModules()`.
//
// CQ-13 fix wave (item 1) — `/medicamentos` devolve `PaginatedResponse<T>`
// (`{items,page,pageSize,totalItems,totalPages}`, ver
// `eventos-clinicos.service.ts::getMedicamentos`), não array cru — a versão
// anterior (`() => []`) trocava o shape inteiro e derrubava `data.items` pra
// `undefined` sob a flag, a MESMA classe de defeito do `KURA_BACKLOG_FIX_5`
// (mock devolvendo shape que o service não espera). Preserva a envelope e só
// esvazia `items`, zerando as contagens de forma coerente com o array vazio —
// mesmo padrão já usado pra `/agenda` (spread + esvazia só o campo aninhado).
export const EMPTY_LIST_TRANSFORMS: [RegExp, (data: unknown) => unknown][] = [
  [/\/agenda$/, (data) => ({ ...(data as Record<string, unknown>), agendamentos: [] })],
  [/\/dashboard\/alertas$/, () => []],
  [/\/dashboard\/recentes$/, () => []],
  [/\/pets\/\d+\/timeline$/, () => []],
  [/\/pets$/, () => []],
  [
    /\/medicamentos$/,
    (data) => ({
      ...(data as Record<string, unknown>),
      items: [],
      totalItems: 0,
      totalPages: 0,
    }),
  ],
];

function applyMockEmptyOverride(url: string, data: unknown): unknown {
  if (process.env.EXPO_PUBLIC_MOCK_EMPTY !== 'true') return data;
  for (const [pattern, transform] of EMPTY_LIST_TRANSFORMS) {
    if (pattern.test(url)) return transform(data);
  }
  return data;
}

export async function resolveMock(config: InternalAxiosRequestConfig): Promise<{
  data: unknown;
  status: number;
  config: InternalAxiosRequestConfig;
}> {
  const url = config.url ?? '';
  const method = config.method?.toUpperCase() ?? 'GET';

  for (const [pattern, handler] of ROUTES) {
    if (pattern.test(url)) {
      await new Promise<void>((r) => setTimeout(r, MOCK_LATENCY_MS));
      const data = await handler(config);
      return { data: applyMockEmptyOverride(url, data), status: 200, config };
    }
  }

  throw new Error(`No mock for ${method} ${url}`);
}
