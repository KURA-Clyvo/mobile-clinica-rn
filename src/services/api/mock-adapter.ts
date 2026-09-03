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
import * as cobrancasMock from '../../mocks/cobrancas.mock';
import * as financeiroMock from '../../mocks/financeiro.mock';

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
  // FM-06 -- subrecurso do evento clínico (CobrancasController.cs, ver
  // ancoragem em cobrancas.mock.ts). Mutuamente exclusiva das 3 entradas
  // `/eventos-clinicos/\d+/...$` acima pela MESMA razão estrutural do
  // bloco de ordem da FM-02 (comentário mais abaixo neste arquivo): sufixo
  // distinto ancorado em `$`, sem overlap possível.
  [/\/eventos-clinicos\/\d+\/cobrancas$/, cobrancasMock.lancar],
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
  // teleconsultaMock.sala, citado acima).
  //
  // 🔴 CORRIGIDO na fix wave da FM-05 (G2, achado A-1). Este comentário dizia
  // "ORDEM IMPORTA: as duas rotas mais específicas (/senha, /reativacao) têm
  // que vir ANTES de /usuarios-clinica/\d+$/, senão a genérica casaria
  // primeiro". **Isso é FALSO, e foi provado falso por mutação**: invertida a
  // ordem exata que a frase dizia que quebraria tudo (byId promovido para
  // antes de /senha e /reativacao), a suíte INTEIRA fica verde — 933/933,
  // EXIT=0, medido em 2026-09-03 pelo maestro e, de forma independente, pela
  // revisão G2. A razão é estrutural: as 4 regex são MUTUAMENTE EXCLUSIVAS
  // por construção — todas ancoradas em `$`, e `\/\d+$/` exige a string
  // TERMINAR EM DÍGITO, enquanto `/senha$` e `/reativacao$` terminam em letra.
  //
  // A varredura exaustiva da G2 confirmou que isso vale para o ROUTES inteiro:
  // 28 entradas × 52 URLs derivadas do código por AST (nunca escritas à mão —
  // regra de ouro v7) ⇒ 378 pares, ZERO colisões, e ZERO entradas sem `$`.
  // Ambos os corpora com controle positivo disparando, porque um `0` só é
  // interpretável se o instrumento provar que enxergaria um `1`.
  //
  // ⚠️ A ordem é mantida assim mesmo, por LEGIBILIDADE (específica antes de
  // genérica é mais fácil de auditar visualmente) — não por obrigação
  // funcional. E ela VOLTA a importar no dia em que alguém acrescentar uma
  // entrada SEM `$`, ou cuja regex seja prefixo de outra: é essa a condição a
  // vigiar, não a ordem em si.
  //
  // 🔴 Por que valeu corrigir uma frase que não causava bug: "documentação que
  // garante o que o código não faz" é um padrão que já REPROVOU task neste
  // projeto (lição do FIX_6), e esta frase estava no arquivo mais auditado do
  // app — todo mock novo copia este bloco. Ela já tinha se propagado para o
  // brief da FM-05 como se fosse fato medido.
  [/\/usuarios-clinica\/\d+\/senha$/, usuariosClinicaMock.senha],
  [/\/usuarios-clinica\/\d+\/reativacao$/, usuariosClinicaMock.reativacao],
  [/\/usuarios-clinica\/\d+$/, usuariosClinicaMock.byId], // GET | PUT | DELETE
  [/\/usuarios-clinica$/, usuariosClinicaMock.colecao], // GET | POST
  // FM-05 — 6 rotas de ServicosPrecoController batem só 2 formas de URL,
  // mesmo padrão de FM-02 acima. Mantido na mesma ORDEM (específica antes de
  // genérica) por LEGIBILIDADE, não por obrigação funcional — as 3 regex
  // abaixo são mutuamente exclusivas pela mesma razão estrutural explicada no
  // bloco da FM-02 (âncora `$` + `\/\d+$/` exigir término em dígito).
  // Provado por mutação nesta task e reconfirmado pela G2. Ver
  // tests/mock-adapter.test.ts, describe "servicos-preco (FM-05)".
  [/\/servicos-preco\/\d+\/reativacao$/, servicosPrecoMock.reativacao],
  [/\/servicos-preco\/\d+$/, servicosPrecoMock.byId], // GET | PUT | DELETE
  [/\/servicos-preco$/, servicosPrecoMock.colecao], // GET | POST
  // FM-07 — único endpoint de FinanceiroController (GET /resumo). Ancorada em `$`, sem
  // nenhum prefixo `/financeiro` em outra entrada deste array — mutuamente exclusiva por
  // construção (não compartilha sufixo com nenhuma outra rota). Ver ancoragem completa em
  // financeiro.mock.ts.
  [/\/financeiro\/resumo$/, financeiroMock.resumo],
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
  //
  // FM-07 — DECISÃO DELIBERADA, razão DIFERENTE das acima: `/financeiro/resumo$/` também
  // NÃO tem entrada aqui, mas não por colisão de método (é `GET` puro, sem POST na mesma
  // URL) — é porque a resposta é um OBJETO único (`ResumoFinanceiroResponseDto`), não uma
  // lista, e o mesmo padrão já vale para `/dashboard/hoje$/` (objeto, sem entrada) logo
  // acima: as duas entradas que ESVAZIAM objeto (`/agenda$/`, `/medicamentos$/`) reescrevem
  // um CAMPO conhecido do objeto (`agendamentos`/`items`) para `[]`, não o objeto inteiro.
  // `applyMockEmptyOverride` faria `() => ({})` virar um objeto sem os campos `required` do
  // DTO -- pior que não interceptar, porque quebraria a tela sob a flag em vez de demonstrar
  // um estado vazio real.
  //
  // 🔴 CORRIGIDO na fix wave da G2 (achado I-2). Estas linhas afirmavam que o estado
  // "nenhuma cobrança no período" era "demonstrável DIRETO na fixture normal, mudando
  // `de`/`ate`". **É FALSO, e foi medido:** `financeiro.mock.ts::resumo()` devolve
  // `receitaBruta = 4820.5` e `nrCobrancas = 12` como LITERAIS, independentemente de
  // `de`/`ate` — só o bloco `periodo`/`periodoAnterior` varia. Nenhum período produz
  // `nrCobrancas: 0`. E `resumoVazio()` NÃO é "usada pelos testes": tinha ZERO
  // consumidores quando esta frase foi escrita.
  //
  // ⇒ **O estado vazio do financeiro NÃO é demonstrável em runtime sob NENHUMA flag hoje.**
  // Ele só existe no nível de teste. **É dívida declarada do FM-09**, que cobra estado vazio
  // verificável — e a correção certa é a mesma que aquele gate já herdou da FM-05 (achado
  // A-6): tornar `applyMockEmptyOverride` sensível ao MÉTODO e ao shape, não acrescentar uma
  // entrada que zere o objeto inteiro.
  //
  // ⚠️ Este comentário era a classe "documentação que garante o que o código não faz" — a
  // mesma que já reprovou task neste projeto — escrita NO MESMO ARQUIVO cujo bloco vizinho
  // (fix wave da FM-05) existe justamente para avisar contra ela.
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
