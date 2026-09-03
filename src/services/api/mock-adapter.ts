import type { InternalAxiosRequestConfig } from 'axios';
import * as authMock from '../../mocks/auth.mock';
import * as dashboardMock from '../../mocks/dashboard.mock';
import * as agendaMock from '../../mocks/agenda.mock';
import * as petsMock from '../../mocks/pets.mock';
import * as eventosMock from '../../mocks/eventos-clinicos.mock';
import * as lunaMock from '../../mocks/luna.mock';
import * as teleconsultaMock from '../../mocks/teleconsulta.mock';
import * as veterinariosMock from '../../mocks/veterinarios.mock';
import * as usuariosClinicaMock from '../../mocks/usuarios-clinica.mock';
import * as servicosPrecoMock from '../../mocks/servicos-preco.mock';

type MockHandler = (config: InternalAxiosRequestConfig) => Promise<unknown>;

const ROUTES: [RegExp, MockHandler][] = [
  [/\/auth\/login$/, authMock.login],
  [/\/auth\/register-clinica$/, authMock.register],
  [/\/agenda$/, agendaMock.agenda],
  // FM-04: rota ABSOLUTA (fora de /api/v1/agenda — ver AgendaController.cs,
  // [HttpPatch("~/api/v1/agendamentos/{id:long}/status")]). Tem que vir
  // antes de qualquer entrada que também case `/agenda` por engano — como
  // não há nenhuma, a ordem aqui não importa por enquanto, mas o padrão de
  // regex por URL (não por método) é o mesmo dos outros — ver resolveMock().
  [/\/agendamentos\/\d+\/status$/, agendaMock.atualizarStatus],
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
  [/\/veterinarios$/, veterinariosMock.veterinarios],
  // FM-02 — 4 rotas de UsuariosClinicaController batem só 2 formas de URL,
  // despachadas por config.method dentro de UM handler cada (mesmo padrão de
  // teleconsultaMock.sala, citado acima). ORDEM IMPORTA: as duas rotas mais
  // específicas (/senha, /reativacao) têm que vir ANTES de
  // /usuarios-clinica/\d+$/, senão a genérica casaria primeiro e nunca
  // deixaria as específicas serem alcançadas.
  [/\/usuarios-clinica\/\d+\/senha$/, usuariosClinicaMock.senha],
  [/\/usuarios-clinica\/\d+\/reativacao$/, usuariosClinicaMock.reativacao],
  [/\/usuarios-clinica\/\d+$/, usuariosClinicaMock.byId], // GET | PUT | DELETE
  [/\/usuarios-clinica$/, usuariosClinicaMock.colecao], // GET | POST
  // FM-05 — 6 rotas de ServicosPrecoController batem só 2 formas de URL,
  // mesmo padrão de FM-02 acima. Mantido na mesma ORDEM (específica antes
  // de genérica) por convenção deste arquivo — 🔴 medido nesta task,
  // CONTRADIZ a alegação original de brief/FM-02 de que a ordem aqui
  // "importa": as 3 regex abaixo são MUTUAMENTE EXCLUSIVAS por construção
  // (todas ancoradas em `$`, e nenhuma é prefixo de outra sem sufixo extra
  // — `/reativacao$/` nunca é alcançada por `\/\d+$/`, que exige a STRING
  // terminar em dígito). Provado por mutação: trocar a ordem das 2
  // primeiras linhas abaixo NÃO derruba nenhum teste (ver
  // tests/mock-adapter.test.ts, describe "servicos-preco (FM-05)" —
  // reproduzido e revertido durante esta task). Mantida a ordem mesmo assim
  // por LEGIBILIDADE (específica-antes-de-genérica continua o padrão mais
  // fácil de auditar visualmente), não porque seja funcionalmente
  // obrigatória para ESTAS 3 regex.
  [/\/servicos-preco\/\d+\/reativacao$/, servicosPrecoMock.reativacao],
  [/\/servicos-preco\/\d+$/, servicosPrecoMock.byId], // GET | PUT | DELETE
  [/\/servicos-preco$/, servicosPrecoMock.colecao], // GET | POST
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
  // FM-05 (brief §5.4) — DECISÃO DELIBERADA: NÃO existe entrada aqui para
  // `/usuarios-clinica$/` nem para `/servicos-preco$/`, e as duas pela
  // MESMA razão. `applyMockEmptyOverride` casa por URL, CEGO A MÉTODO — a
  // mesma URL serve GET (lista) e POST (criar) para os dois recursos.
  // Adicionar uma entrada esvaziaria também a resposta de CRIAÇÃO sob
  // `EXPO_PUBLIC_MOCK_EMPTY=true` (o objeto recém-criado viraria `[]`),
  // quebrando "+ Novo" sob a flag — sem nenhum aviso, porque
  // `applyMockEmptyOverride` não sabe que o handler despachou por POST.
  // Replicar o padrão de `/agenda`/`/medicamentos` aqui reintroduziria essa
  // classe de defeito por engano. Se um dia isto precisar de um estado
  // vazio demonstrável, a correção é `applyMockEmptyOverride` também
  // enxergar `method`, não uma entrada nova nesta lista.
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
