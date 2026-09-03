import { resolveMock, EMPTY_LIST_TRANSFORMS } from '../src/services/api/mock-adapter';
import { __resetStoreParaTeste } from '../src/mocks/agenda.mock';
import { __resetStoreParaTeste as __resetServicosPrecoParaTeste } from '../src/mocks/servicos-preco.mock';
import type { InternalAxiosRequestConfig } from 'axios';
import type { ServicoPrecoResponse } from '../src/types/api';

function makeConfig(url: string, method = 'GET', data?: unknown): InternalAxiosRequestConfig {
  return { url, method, headers: {}, data: data !== undefined ? JSON.stringify(data) : undefined } as InternalAxiosRequestConfig;
}

// FM-05 — mesma forma de config que o axios de verdade produz para uma
// chamada com `params`: NUNCA concatenados em `config.url` (ver brief
// §3.2/mock-adapter.ts, cabeçalho de EMPTY_LIST_TRANSFORMS).
function makeConfigComParams(
  url: string,
  method: string,
  params: Record<string, unknown>,
): InternalAxiosRequestConfig {
  return { url, method, headers: {}, params } as InternalAxiosRequestConfig;
}

// FM-04: o mock de agenda passou a ser stateful (agenda.mock.ts::_store) —
// sem resetar entre testes, um PATCH de um `it()` vazaria pro próximo (o
// registro de módulos do Jest é por ARQUIVO, não por `it()`).
beforeEach(() => {
  __resetStoreParaTeste();
  __resetServicosPrecoParaTeste();
});

describe('mock-adapter', () => {
  it('resolves /auth/login', async () => {
    const res = await resolveMock(makeConfig('/auth/login', 'POST'));
    expect(res.status).toBe(200);
    const data = res.data as { accessToken: string; expiresAt: string };
    expect(data.accessToken).toContain('kura_mock_jwt');
    expect(data.expiresAt).toBeDefined();
  });

  // TASK-65 (FIX_5): resolveMock() devolve o shape RAW do .NET (DashboardHojeApiDto —
  // `totalConsultasHoje`), não mais o app-facing (`metrics.nrConsultasHoje`) que
  // dashboard.service.ts produz DEPOIS de mapear. Testar o raw aqui (nível do
  // adapter) e o mapeado em tests/mock-contract-audit.test.ts (nível do service) —
  // ver ficha desse achado em docs/mock-contract-audit.md (mobile-tutor-rn).
  it('resolves /dashboard/hoje', async () => {
    const res = await resolveMock(makeConfig('/dashboard/hoje'));
    const data = res.data as { totalConsultasHoje: number; ultimosPetsAtendidos: unknown[] };
    expect(data.totalConsultasHoje).toBe(8);
    expect(Array.isArray(data.ultimosPetsAtendidos)).toBe(true);
  });

  it('resolves /dashboard/alertas with 5 items', async () => {
    const res = await resolveMock(makeConfig('/dashboard/alertas'));
    const data = res.data as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(5);
  });

  it('resolves /dashboard/recentes with 5 items', async () => {
    const res = await resolveMock(makeConfig('/dashboard/recentes'));
    const data = res.data as unknown[];
    expect(data.length).toBe(5);
  });

  it('resolves /pets list', async () => {
    const res = await resolveMock(makeConfig('/pets'));
    const data = res.data as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(12);
  });

  it('resolves /pets/1', async () => {
    const res = await resolveMock(makeConfig('/pets/1'));
    const data = res.data as { id: number; nmPet: string };
    expect(data.id).toBe(1);
    expect(data.nmPet).toBe('Thor');
  });

  it('rejects /pets/999 with 404', async () => {
    await expect(resolveMock(makeConfig('/pets/999'))).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });

  it('resolves /pets/1/timeline', async () => {
    const res = await resolveMock(makeConfig('/pets/1/timeline'));
    const data = res.data as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('resolves /pets/999/timeline as empty array (edge case)', async () => {
    const res = await resolveMock(makeConfig('/pets/999/timeline'));
    expect(res.data).toEqual([]);
  });

  it('resolves /eventos-clinicos/consultas', async () => {
    const res = await resolveMock(makeConfig('/eventos-clinicos/consultas', 'POST'));
    const data = res.data as { idEventoClinico: number; idConsulta: number };
    expect(data.idEventoClinico).toBeDefined();
    expect(data.idConsulta).toBeDefined();
  });

  it('resolves /medicamentos', async () => {
    const res = await resolveMock(makeConfig('/medicamentos'));
    const data = res.data as { items: unknown[]; totalItems: number };
    expect(data.items.length).toBe(10);
    expect(data.totalItems).toBe(10);
  });

  // CQ-09: rota trocada de /health (liveness simples, {status:'ok'}, não usada pelos
  // cards de sub-serviço) para /ready ({status, oracle, kura_api}) — ver JSDoc de
  // getLunaHealth em luna.service.ts.
  it('resolves /luna/ready', async () => {
    const res = await resolveMock(makeConfig('/luna/ready'));
    const data = res.data as { status: string; oracle: string; kura_api: string };
    expect(data.status).toBe('ok');
    expect(data.oracle).toBe('ok');
    expect(data.kura_api).toBe('ok');
  });

  it('resolves /luna/whatsapp/enviar', async () => {
    const res = await resolveMock(makeConfig('/luna/whatsapp/enviar', 'POST'));
    const data = res.data as { status: string; sid?: string };
    expect(data.status).toBe('enviado');
  });

  it('resolves /eventos-clinicos/{id}/receituario', async () => {
    const res = await resolveMock(makeConfig('/eventos-clinicos/100/receituario', 'POST'));
    const data = res.data as { dsTipoMime: string; nmArquivo: string };
    expect(data.dsTipoMime).toBe('application/pdf');
    expect(data.nmArquivo).toContain('.pdf');
  });

  // CQ-09: resolveMock() devolve o shape RAW real (totalTriagens/porUrgencia com
  // ALTA/MEDIA/BAIXA), não mais o shape interno do app — a tradução acontece em
  // luna.service.ts (mesmo padrão de /dashboard/hoje acima, TASK-65).
  it('resolves /luna/triagens/relatorio', async () => {
    const res = await resolveMock(makeConfig('/luna/triagens/relatorio'));
    const data = res.data as { totalTriagens: number; porUrgencia: Record<string, number> };
    expect(data.totalTriagens).toBeGreaterThan(0);
    expect(data.porUrgencia['ALTA']).toBeDefined();
  });

  it('throws descriptive error for unknown route', async () => {
    await expect(resolveMock(makeConfig('/unknown/route'))).rejects.toThrow(
      'No mock for GET /unknown/route',
    );
  });

  it('simulates latency of ~300ms', async () => {
    const start = Date.now();
    await resolveMock(makeConfig('/dashboard/hoje'));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(280);
  });

  // TASK-65 (FIX_5): reescrito — `idPet`/`dsTipoAlerta` (app-facing) não existem no
  // shape RAW (AlertaApiDto usa `tipo`/`dsTipoAlerta` DIFERENTE: aqui `dsTipoAlerta`
  // é o subtipo cru do .NET, ex. 'ACIMA_LIMITE', não o enum traduzido
  // 'IOT_TEMPERATURA'). A garantia antiga (idPet sempre undefined após o mapeamento,
  // porque DashboardService.GetAlertasAsync não inclui esse campo em nenhuma forma)
  // é uma propriedade do MAPPER, não do fixture raw — testada agora em
  // tests/mock-contract-audit.test.ts, no nível do service.
  it('alertas raw usa os dois subtipos reais do .NET (TEMPERATURA/VACINA_VENCENDO)', async () => {
    const res = await resolveMock(makeConfig('/dashboard/alertas'));
    const data = res.data as Array<{ tipo: string; dsTipoAlerta: string }>;
    const tipos = new Set(data.map((a) => a.tipo));
    expect(tipos).toEqual(new Set(['TEMPERATURA', 'VACINA_VENCENDO']));
  });

  it('pet com tutores vazios exists (Bolinha, id=7)', async () => {
    const res = await resolveMock(makeConfig('/pets/7'));
    const data = res.data as { tutores: unknown[] };
    expect(data.tutores).toEqual([]);
  });
});

// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1), item 5 — sem isto não há como
// provar visualmente o trabalho da task (item 1): em modo mock todas as telas
// têm dado, então o estado vazio nunca aparece. Lida DENTRO de
// `applyMockEmptyOverride()` a cada chamada (não cacheada em `const` de
// módulo) — daí não precisar de `jest.resetModules()` aqui, só setar/limpar
// `process.env` a cada teste.
describe('mock-adapter — EXPO_PUBLIC_MOCK_EMPTY (CQ-13, item 5)', () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_MOCK_EMPTY;
  });

  it('default (desligada): /dashboard/alertas continua devolvendo os 5 itens normais', async () => {
    const res = await resolveMock(makeConfig('/dashboard/alertas'));
    expect((res.data as unknown[]).length).toBe(5);
  });

  it('ligada: /dashboard/alertas devolve lista vazia', async () => {
    process.env.EXPO_PUBLIC_MOCK_EMPTY = 'true';
    const res = await resolveMock(makeConfig('/dashboard/alertas'));
    expect(res.data).toEqual([]);
  });

  it('ligada: /dashboard/recentes devolve lista vazia', async () => {
    process.env.EXPO_PUBLIC_MOCK_EMPTY = 'true';
    const res = await resolveMock(makeConfig('/dashboard/recentes'));
    expect(res.data).toEqual([]);
  });

  it('ligada: /agenda esvazia SÓ o campo aninhado `agendamentos`, preserva dataInicio/dataFim', async () => {
    process.env.EXPO_PUBLIC_MOCK_EMPTY = 'true';
    const res = await resolveMock({
      url: '/agenda',
      method: 'GET',
      headers: {},
      params: { dataInicio: '2026-08-24', dataFim: '2026-08-30' },
    } as unknown as InternalAxiosRequestConfig);
    const data = res.data as { agendamentos: unknown[]; dataInicio: string; dataFim: string };
    expect(data.agendamentos).toEqual([]);
    expect(data.dataInicio).toBe('2026-08-24');
    expect(data.dataFim).toBe('2026-08-30');
  });

  it('ligada: /pets devolve lista vazia (dispara o EMPTY_LIST de PacientesScreen)', async () => {
    process.env.EXPO_PUBLIC_MOCK_EMPTY = 'true';
    const res = await resolveMock(makeConfig('/pets'));
    expect(res.data).toEqual([]);
  });

  it('ligada: /pets/1/timeline devolve lista vazia (pet 1 tem timeline real em modo normal)', async () => {
    process.env.EXPO_PUBLIC_MOCK_EMPTY = 'true';
    const res = await resolveMock(makeConfig('/pets/1/timeline'));
    expect(res.data).toEqual([]);
  });

  it('ligada: /pets/1 (detalhe, NÃO é lista) continua devolvendo o pet normal', async () => {
    process.env.EXPO_PUBLIC_MOCK_EMPTY = 'true';
    const res = await resolveMock(makeConfig('/pets/1'));
    const data = res.data as { id: number; nmPet: string };
    expect(data.id).toBe(1);
    expect(data.nmPet).toBe('Thor');
  });

  // CQ-13 fix wave (item 1) — reproduz explicitamente o que a G2 mediu como
  // A2: com a flag ligada, /medicamentos preservava o shape errado
  // (`() => []`, array cru) contra o `PaginatedResponse<T>` que
  // `getMedicamentos()` espera. Espelha o teste de `/pets/1` acima
  // (`/medicamentos` também não é uma lista "achatada" — é uma envelope
  // paginada, esvaziar tem que preservar as chaves de topo).
  it('ligada: /medicamentos preserva a envelope paginada, esvazia só items e zera as contagens', async () => {
    process.env.EXPO_PUBLIC_MOCK_EMPTY = 'true';
    const res = await resolveMock(makeConfig('/medicamentos'));
    const data = res.data as {
      items: unknown[];
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
    expect(data.items).toEqual([]);
    expect(data.totalItems).toBe(0);
    expect(data.totalPages).toBe(0);
    expect(typeof data.page).toBe('number');
    expect(typeof data.pageSize).toBe('number');
  });
});

// FM-04: primeiro handler de PATCH deste repo. Prova as duas coisas que o
// brief chamou de achado nº 3 e nº 4 — a rota existe no mock-adapter, E o
// PATCH persiste no MESMO store que o GET /agenda lê depois.
describe('mock-adapter — PATCH /agendamentos/{id}/status (FM-04)', () => {
  it('rota nova existe: PATCH /agendamentos/5/status não lança "No mock for..."', async () => {
    const res = await resolveMock(
      makeConfig('/agendamentos/5/status', 'PATCH', { dsStatus: 'CONFIRMADO', nrVersion: 1 }),
    );
    expect(res.status).toBe(200);
    const data = res.data as { idAgendamento: number; dsStatus: string; nrVersion: number };
    expect(data.idAgendamento).toBe(5);
    expect(data.dsStatus).toBe('CONFIRMADO');
    // nrVersion incrementado pelo "servidor" mock, igual ao real (AgendaService.cs:
    // `agendamento.NrVersion = dto.NrVersion + 1`).
    expect(data.nrVersion).toBe(2);
  });

  // A prova central do achado nº 3: buildAppointments() reconstruía a lista
  // do zero a cada chamada — um GET /agenda depois do PATCH devolvia o
  // status ORIGINAL, revertendo a mudança na tela. Mordida: comentar a linha
  // `if (!_store) { _store = buildAppointments(); }` para sempre chamar
  // `buildAppointments()` direto (o comportamento antigo) faz este teste
  // falhar — `depoisDoPatch.dsStatus` volta a ser 'AGENDADO'.
  it('um GET /agenda depois do PATCH reflete o novo status (não reverte)', async () => {
    const antesDoPatch = await resolveMock(
      makeConfig('/agenda', 'GET', undefined) as unknown as InternalAxiosRequestConfig,
    );
    const antes = (antesDoPatch.data as { agendamentos: { idAgendamento: number; dsStatus: string }[] })
      .agendamentos.find((a) => a.idAgendamento === 3);
    expect(antes?.dsStatus).toBe('AGENDADO');

    await resolveMock(
      makeConfig('/agendamentos/3/status', 'PATCH', { dsStatus: 'CONFIRMADO', nrVersion: 1 }),
    );

    const depoisDoPatch = await resolveMock(makeConfig('/agenda'));
    const depois = (depoisDoPatch.data as { agendamentos: { idAgendamento: number; dsStatus: string }[] })
      .agendamentos.find((a) => a.idAgendamento === 3);
    expect(depois?.dsStatus).toBe('CONFIRMADO');
  });

  it('rejeita com 409 quando nrVersion não bate com o do agendamento armazenado', async () => {
    await expect(
      resolveMock(makeConfig('/agendamentos/3/status', 'PATCH', { dsStatus: 'CONFIRMADO', nrVersion: 999 })),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('rejeita com 404 para um id de agendamento inexistente', async () => {
    await expect(
      resolveMock(makeConfig('/agendamentos/99999/status', 'PATCH', { dsStatus: 'CONFIRMADO', nrVersion: 1 })),
    ).rejects.toMatchObject({ status: 404 });
  });
});

// CQ-13 fix wave (item 1) — regra de ouro v7 do CLAUDE.md: "o gate tem que
// derivar a lista de consumidores do código e falhar quando aparecer
// consumidor sem check". Em vez de listar à mão quais entradas de
// `EMPTY_LIST_TRANSFORMS` precisam preservar shape de objeto (que é
// exatamente como a entrada de `/medicamentos` ficou sem cobertura), este
// bloco ITERA sobre a tabela real exportada do módulo e aplica a mesma regra
// genérica a cada entrada: array continua array; objeto continua objeto com
// as MESMAS chaves de topo da resposta normal. Uma entrada nova com shape
// errado — array virando objeto, objeto virando array, ou objeto perdendo/
// trocando uma chave de topo — quebra este teste sozinha, sem que ninguém
// precise lembrar de adicionar um caso.
describe('mock-adapter — EMPTY_LIST_TRANSFORMS preserva a FORMA da resposta normal (derivado da tabela)', () => {
  // Conversão puramente mecânica de regex -> URL de amostra: NÃO codifica
  // conhecimento de rota à mão (não é uma segunda lista de URLs mantida em
  // paralelo) — só desfaz o que `ROUTES`/`EMPTY_LIST_TRANSFORMS` já escrevem
  // como regex (`\/agenda$` -> `/agenda`, `\/pets\/\d+\/timeline$` ->
  // `/pets/1/timeline`).
  function sampleUrlFor(pattern: RegExp): string {
    return pattern.source
      .replace(/\$$/, '')
      .replace(/^\^/, '')
      .replace(/\\\//g, '/')
      .replace(/\\d\+/g, '1');
  }

  it.each(
    EMPTY_LIST_TRANSFORMS.map(
      ([pattern, transform]) => [sampleUrlFor(pattern), pattern.source, transform] as const,
    ),
  )(
    '%s (padrão %s): sob a flag, array continua array e objeto mantém as mesmas chaves de topo',
    async (url, _patternSource, transform) => {
      const normal = await resolveMock(makeConfig(url));
      const normalData = normal.data;
      const emptied = transform(normalData);

      if (Array.isArray(normalData)) {
        expect(Array.isArray(emptied)).toBe(true);
      } else {
        expect(normalData).not.toBeNull();
        expect(typeof normalData).toBe('object');
        // O ponto central da trava: um transform que troca objeto por array
        // (o bug original de /medicamentos) tem que quebrar aqui.
        expect(Array.isArray(emptied)).toBe(false);
        expect(emptied).not.toBeNull();
        expect(typeof emptied).toBe('object');

        const chavesAntes = Object.keys(normalData as Record<string, unknown>).sort();
        const chavesDepois = Object.keys(emptied as Record<string, unknown>).sort();
        expect(chavesDepois).toEqual(chavesAntes);
      }
    },
  );
});

// FM-05 (brief §3.2/§3.3) — a armadilha central deste ciclo: as entradas de
// ROUTES são regex ANCORADAS EM `$`, e `params` NUNCA aparece em
// `config.url` na cadeia real (apiClient -> interceptor de mock ->
// resolveMock). Se alguém concatenasse `?incluirInativos=true` na URL, o
// `$` pararia de casar e o mock NUNCA dispararia — silenciosamente, em modo
// mock, que é o caminho da demo. Este bloco prova as duas formas de
// chamada (com e sem o flag) E a ordem de despacho entre as 3 rotas de
// ServicosPrecoController que compartilham prefixo de URL.
describe('mock-adapter — servicos-preco (FM-05)', () => {
  it('GET /servicos-preco SEM params (equivalente a incluirInativos=false) devolve só os ATIVOS', async () => {
    const res = await resolveMock(makeConfig('/servicos-preco'));
    const lista = res.data as ServicoPrecoResponse[];
    expect(lista.every((s) => s.stAtiva)).toBe(true);
    // Controle positivo do próprio seed: se ISTO falhasse, o teste acima
    // seria indistinguível de "a store não tem inativo nenhum".
    expect(lista.length).toBeGreaterThan(0);
  });

  it('GET /servicos-preco COM params incluirInativos:true traz também o inativo do seed', async () => {
    const res = await resolveMock(makeConfigComParams('/servicos-preco', 'GET', { incluirInativos: true }));
    const lista = res.data as ServicoPrecoResponse[];
    expect(lista.some((s) => !s.stAtiva)).toBe(true);
  });

  it('a lista vem ORDENADA por nmServico (ServicoPrecoRepository.cs:29, .OrderBy)', async () => {
    const res = await resolveMock(makeConfigComParams('/servicos-preco', 'GET', { incluirInativos: true }));
    const nomes = (res.data as ServicoPrecoResponse[]).map((s) => s.nmServico);
    expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')));
  });

  it('POST /servicos-preco/{id}/reativacao NÃO é engolido pela rota genérica /servicos-preco/{id} (ordem em ROUTES)', async () => {
    // Desativa o id 3 do seed e reativa por essa rota específica -- se a
    // ordem de ROUTES estivesse errada (genérica antes da específica), esta
    // chamada bateria em `byId` (que não tem verbo POST tratado como
    // reativação) em vez de `reativacao`.
    const reativado = await resolveMock(makeConfig('/servicos-preco/3/reativacao', 'POST'));
    expect((reativado.data as ServicoPrecoResponse).stAtiva).toBe(true);
  });

  it('POST /servicos-preco (criar) não é afetado por EXPO_PUBLIC_MOCK_EMPTY (§5.4: sem entrada em EMPTY_LIST_TRANSFORMS)', async () => {
    const original = process.env.EXPO_PUBLIC_MOCK_EMPTY;
    process.env.EXPO_PUBLIC_MOCK_EMPTY = 'true';
    try {
      const res = await resolveMock(
        makeConfig('/servicos-preco', 'POST', { nmServico: 'Exame de sangue', vlPreco: 80 }),
      );
      const criado = res.data as ServicoPrecoResponse;
      // Se houvesse uma entrada para `/servicos-preco$/` em
      // EMPTY_LIST_TRANSFORMS (decisão que este ciclo REJEITOU, ver
      // mock-adapter.ts), esta resposta viraria `[]` -- a mordida que prova
      // por que a rejeição é a decisão certa.
      expect(Array.isArray(criado)).toBe(false);
      expect(criado.nmServico).toBe('Exame de sangue');
    } finally {
      process.env.EXPO_PUBLIC_MOCK_EMPTY = original;
    }
  });
});

// FM-06 — a rota nova compartilha o PREFIXO `/eventos-clinicos/{id}/...`
// com 3 entradas já existentes (`/transcricao$`, `/soap$`, `/receituario$`)
// -- este describe prova o despacho E a NÃO-colisão, mesma disciplina do
// describe "servicos-preco (FM-05)" acima. As 4 regex são mutuamente
// exclusivas por construção (sufixo distinto + âncora `$`), não por ordem
// -- ver o comentário de mock-adapter.ts sobre a FALSA doutrina de ordem já
// corrigida na fix wave da FM-05.
describe('mock-adapter — cobrancas (FM-06)', () => {
  it('resolves POST /eventos-clinicos/{id}/cobrancas', async () => {
    const res = await resolveMock(
      makeConfig('/api/v1/eventos-clinicos/700/cobrancas', 'POST', { vlCobrado: 50 }),
    );
    expect(res.status).toBe(200); // resolveMock sempre devolve 200 (ver cabeçalho do arquivo)
    const data = res.data as { idEventoClinico: number; vlCobrado: number };
    expect(data.idEventoClinico).toBe(700);
    expect(data.vlCobrado).toBe(50);
  });

  it('/eventos-clinicos/{id}/cobrancas NÃO colide com /transcricao, /soap nem /receituario do mesmo evento', async () => {
    const transcricao = await resolveMock(
      makeConfig('/api/v1/eventos-clinicos/701/transcricao', 'POST'),
    );
    const cobranca = await resolveMock(
      makeConfig('/api/v1/eventos-clinicos/701/cobrancas', 'POST', { vlCobrado: 10 }),
    );
    // Formas de resposta são inconfundíveis entre os dois handlers -- se a
    // rota errada tivesse sido invocada por engano, um dos dois campos
    // abaixo estaria ausente/undefined.
    expect((transcricao.data as { soap: unknown }).soap).toBeDefined();
    expect((cobranca.data as { vlCobrado: unknown }).vlCobrado).toBeDefined();
  });

  it('POST /eventos-clinicos/{id}/cobrancas não é afetado por EXPO_PUBLIC_MOCK_EMPTY (sem entrada em EMPTY_LIST_TRANSFORMS -- não é lista)', async () => {
    const original = process.env.EXPO_PUBLIC_MOCK_EMPTY;
    process.env.EXPO_PUBLIC_MOCK_EMPTY = 'true';
    try {
      const res = await resolveMock(
        makeConfig('/api/v1/eventos-clinicos/702/cobrancas', 'POST', { vlCobrado: 20 }),
      );
      const cobranca = res.data as { vlCobrado: number };
      expect(cobranca.vlCobrado).toBe(20);
    } finally {
      process.env.EXPO_PUBLIC_MOCK_EMPTY = original;
    }
  });
});
