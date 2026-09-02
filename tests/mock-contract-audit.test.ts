// TASK-65 (FIX_5) / TASK-71 (FIX_6): G4b — varredura sistemática mock x consumidor,
// mobile-clinica-rn.
// Mesma disciplina do auth.mock-contract.test.ts (TASK-64, mobile-tutor-rn): EXERCITA
// a função de verdade (service -> apiClient real -> mock-adapter -> mocks/*.mock.ts),
// sem jest.mock do apiClient/mock-adapter (o resto da suíte deste repo — ex.:
// agenda.service.test.ts, dashboard.service.test.ts — mocka apiClient.get direto e
// nunca toca os fixtures reais do mock-adapter; foi exatamente essa lacuna que
// deixou os bugs abaixo sobreviverem). Ver docs/mock-contract-audit.md (no
// mobile-tutor-rn) para a tabela completa dos dois apps.
//
// Achados corrigidos aqui:
//   - getHoje: mapHoje lê `dto.ultimosPetsAtendidos.length`; o mock devolvia
//     DashboardHojeResponse (app-facing, sem essa chave) -> TypeError "Cannot read
//     properties of undefined (reading 'length')".
//   - getAgenda: lê `response.data.agendamentos.map(...)`; o mock devolvia um array
//     nu de AgendamentoResponse (sem wrapper `{dataInicio,dataFim,agendamentos}`)
//     -> TypeError "Cannot read properties of undefined (reading 'map')".
//   - getAlertas / getRecentes: não lançavam, mas liam campos que não existem no
//     tipo app-facing (`raw.tipo`, `dto.nmPaciente`, `dto.dsServico`, `dto.stStatus`)
//     -> todo alerta virava 'RETORNO_PENDENTE' e todo agendamento recente saía com
//     nmPet/nmTipoConsulta undefined e sgStatus fixo em 'AGENDADA'.
import { getHoje, getAlertas, getRecentes } from '../src/services/dashboard.service';
import { getAgenda, atualizarStatusAgendamento } from '../src/services/agenda.service';
import { login, registerClinica } from '../src/services/auth.service';
import { listPets, getPetById, getPetTimeline } from '../src/services/pets.service';
import { criarConsulta, getMedicamentos } from '../src/services/eventos-clinicos.service';
import { enviarWhatsApp, getLunaHealth, getRelatorioTriagens } from '../src/services/luna.service';
import { criarOuObterSala, obterSala } from '../src/services/teleconsulta.service';

describe('Contrato de modo mock (EXPO_PUBLIC_USE_MOCKS=true) — G4b, TASK-65', () => {
  const originalUseMocks = process.env.EXPO_PUBLIC_USE_MOCKS;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_USE_MOCKS = 'true';
  });

  afterEach(() => {
    process.env.EXPO_PUBLIC_USE_MOCKS = originalUseMocks;
  });

  describe('dashboard.service', () => {
    it('getHoje executa sem lançar e devolve métricas numéricas reais', async () => {
      const res = await getHoje();
      expect(typeof res.metrics.nrConsultasHoje).toBe('number');
      expect(Number.isNaN(res.metrics.nrConsultasHoje)).toBe(false);
      expect(typeof res.metrics.nrPacientesAtendidos).toBe('number');
      expect(Number.isNaN(res.metrics.nrPacientesAtendidos)).toBe(false);
      expect(typeof res.metrics.nrAlertasAtivos).toBe('number');
      expect(Number.isNaN(res.metrics.nrAlertasAtivos)).toBe(false);
    });

    it('getAlertas executa sem lançar e traduz o tipo real do alerta (não genérico fixo)', async () => {
      const res = await getAlertas();
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBeGreaterThan(0);
      const tipos = new Set(res.map(a => a.dsTipoAlerta));
      // com o raw shape (tipo: 'TEMPERATURA'|'VACINA_VENCENDO') a tradução deve
      // produzir mais de um valor distinto — se tudo virou 'RETORNO_PENDENTE' é
      // sinal de `raw.tipo` lido de um shape que não tem essa chave.
      expect(tipos.size).toBeGreaterThan(1);
      // Garantia pré-existente do mapper (mapAlerta, dashboard.service.ts): idPet/
      // nmPet ficam sempre undefined, porque DashboardService.GetAlertasAsync não
      // inclui esses campos em nenhuma das duas formas de alerta. Não é uma
      // regressão desta task — só passou a ser testável de verdade agora que o
      // fixture raw devolve o shape certo (antes o `raw.idPet` do mock antigo TAMBÉM
      // não existia, então este teste teria "passado" pela razão errada).
      for (const a of res) {
        expect(a.idPet).toBeUndefined();
        expect(a.nmPet).toBeUndefined();
      }
    });

    it('getRecentes executa sem lançar e preenche nmPet/nmTipoConsulta reais', async () => {
      const res = await getRecentes();
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBeGreaterThan(0);
      for (const r of res) {
        expect(typeof r.nmPet).toBe('string');
        expect(r.nmPet.length).toBeGreaterThan(0);
        expect(typeof r.nmTipoConsulta).toBe('string');
        expect(r.nmTipoConsulta.length).toBeGreaterThan(0);
      }
      const statuses = new Set(res.map(r => r.sgStatus));
      expect(statuses.size).toBeGreaterThan(1);
    });
  });

  describe('agenda.service', () => {
    it('getAgenda executa sem lançar e devolve agendamentos mapeados', async () => {
      const res = await getAgenda({ dataInicio: '2020-01-01', dataFim: '2030-01-01' });
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBeGreaterThan(0);
      for (const a of res) {
        expect(typeof a.id).toBe('number');
        expect(typeof a.pet.nmPet).toBe('string');
        expect(a.pet.nmPet.length).toBeGreaterThan(0);
        expect(typeof a.veterinario.nmVeterinario).toBe('string');
      }
    });

    // FM-04, achado nº 4 do brief: a rota nova precisa entrar no
    // mock-adapter, e o par service×mock precisa devolver o shape CRU do
    // backend (AgendamentoItemApiDto), não o shape app-facing — é a regra
    // que já quebrou 10 pares neste repo (TASK-65/FIX_5). Executa a cadeia
    // REAL: service -> apiClient (mockado só na config de baseURL) ->
    // mock-adapter -> agenda.mock.ts, sem jest.mock do apiClient.
    it('atualizarStatusAgendamento executa sem lançar e devolve o agendamento mapeado', async () => {
      const agenda = await getAgenda({ dataInicio: '2020-01-01', dataFim: '2030-01-01' });
      const alvo = agenda.find((a) => a.sgStatus === 'AGENDADA');
      expect(alvo).toBeDefined();

      const atualizado = await atualizarStatusAgendamento(alvo!.id, {
        dsStatus: 'CONFIRMADO',
        nrVersion: alvo!.nrVersion,
      });

      expect(atualizado.id).toBe(alvo!.id);
      expect(atualizado.sgStatus).toBe('CONFIRMADA');
      expect(atualizado.dsStatusOrigem).toBe('CONFIRMADO');
      // nrVersion tem que ter avançado — não o mesmo valor enviado.
      expect(atualizado.nrVersion).toBe(alvo!.nrVersion + 1);
    });
  });

  // Pares pass-through (`{data} = await apiClient.x(...)` sem transformação) — baixo
  // risco por construção, já que mock e service consomem o mesmo tipo app-facing.
  // Executados aqui, não só lidos por inspeção (mesma disciplina do passo 5 da
  // TASK-65 — "não classificar por leitura").
  // ─── FM-01 ────────────────────────────────────────────────────────────
  //
  // Este bloco existe por um achado que a FM-04 mediu e a revisão G2 dela
  // confirmou: `config.data` que chega a um handler de mock PELA CADEIA REAL
  // do apiClient é o OBJETO JS original, nunca uma string JSON — o request
  // interceptor rejeita ANTES de o axios serializar
  // (services/api/client.ts::buildRequestInterceptor).
  //
  // `auth.mock.ts::register` fazia `JSON.parse(config.data ?? '{}')`, que
  // sobre um objeto vira `JSON.parse("[object Object]")` e LANÇA. Nenhum
  // teste deste repo exercitava `registerClinica` por essa cadeia — só por
  // fixtures que montavam `config.data` como string à mão, o que escondia o
  // defeito.
  //
  // 🔴 É exatamente por isso que este ARQUIVO existe: ele é o único que roda
  // service -> apiClient real -> mock-adapter -> fixture, SEM `jest.mock`.
  describe('auth.service — registerClinica pela cadeia real (FM-01)', () => {
    const CORPO = {
      nmClinica: 'Clínica Teste',
      nrCnpj: '12345678000199',
      dsEndereco: 'Rua A, 1',
      nmCidade: 'São Paulo',
      sgUf: 'SP',
      nrCep: '01000000',
      dsEmail: 'contato@clinica.com',
      dsEmailAcesso: 'gestor@clinica.com',
      dsSenha: 'segredo123',
      nmVeterinarioAdmin: 'Dra. Ana Souza',
      nrCRMV: 'SP-99999',
    };

    it('não lança com `config.data` OBJETO — a forma que a cadeia real entrega', async () => {
      const res = await registerClinica(CORPO);
      expect(res.accessToken).toEqual(expect.any(String));
    });

    it('lê o corpo de verdade: os campos enviados voltam na resposta', async () => {
      const res = await registerClinica(CORPO);
      // Se `parseBody` devolvesse `{}` em vez de lançar, isto ficaria
      // `undefined` — ou seja, este par distingue "não lançou" de "leu".
      expect(res.usuario.nmVeterinario).toBe('Dra. Ana Souza');
      expect(res.usuario.nrCRMV).toBe('SP-99999');
    });

    it('devolve tpPerfil GESTOR, como o contrato real do .NET', async () => {
      // RegisterClinicaResponseDto.TpPerfil é sempre 'GESTOR' — o registro
      // cria o USUARIO_CLINICA gestor na mesma transação.
      const res = await registerClinica(CORPO);
      expect(res.tpPerfil).toBe('GESTOR');
    });

    it('login devolve tpPerfil — campo novo da FD-03', async () => {
      const res = await login({ dsEmail: 'a@b.com', dsSenha: 'x' });
      expect(res.tpPerfil).toBe('VETERINARIO');
    });
  });

  describe('pass-throughs (baixo risco, executados para confirmar)', () => {
    it('login / listPets / getPetById / getPetTimeline executam sem lançar', async () => {
      const loginRes = await login({ dsEmail: 'a@b.com', dsSenha: 'x' });
      expect(typeof loginRes.accessToken).toBe('string');

      const pets = await listPets();
      expect(Array.isArray(pets)).toBe(true);
      expect(pets.length).toBeGreaterThan(0);

      const pet = await getPetById(pets[0]!.id);
      expect(pet.id).toBe(pets[0]!.id);

      const timeline = await getPetTimeline(1);
      expect(Array.isArray(timeline)).toBe(true);
    });

    it('criarConsulta / getMedicamentos executam sem lançar', async () => {
      const consulta = await criarConsulta({
        idPet: 1, idVeterinario: 1, dtConsulta: new Date().toISOString(), dsMotivo: 'Check-up',
      });
      expect(typeof consulta.idEventoClinico).toBe('number');

      const medicamentos = await getMedicamentos();
      expect(Array.isArray(medicamentos.items)).toBe(true);
      expect(medicamentos.items.length).toBeGreaterThan(0);
    });

    it('enviarWhatsApp / getLunaHealth executam sem lançar (nunca propagam exceção — try/catch próprio)', async () => {
      const envio = await enviarWhatsApp({ telefone: '11999990000', mensagem: 'teste', tipo: 'manual' });
      expect(envio.status).toBe('enviado');

      // CQ-09: getLunaHealth() agora bate em GET /ready ({status,oracle,kura_api}) —
      // sgStatus nunca existiu no shape real e não deve reaparecer aqui.
      const health = await getLunaHealth();
      expect('oracle' in health).toBe(true);
      expect('sgStatus' in health).toBe(false);
    });

    // CQ-09 fix wave (G2 Minor-3): getRelatorioTriagens não estava neste bloco de
    // pass-throughs, mas NÃO é pass-through — é justamente a função que esta task deu
    // um tradutor (shape de fio -> tipo interno), e o mock passou a devolver o shape
    // de fio (ver src/mocks/luna.mock.ts). Exercita o caminho real
    // (apiClient -> mock-adapter -> lunaMock.relatorioTriagens -> tradutor), sem
    // jest.mock do client, para travar na suíte o critério de aceite literal do
    // backlog ("modo real e modo mock mostram o mesmo número para o mesmo dado") —
    // antes disto só tinha sido verificado por uma sonda temporária de revisão.
    it('getRelatorioTriagens (modo mock real) traduz o shape de fio e devolve total > 0', async () => {
      const relatorio = await getRelatorioTriagens({
        dataInicio: '2026-01-01',
        dataFim: '2026-01-08',
      });
      expect(relatorio.nrTotalTriagens).toBeGreaterThan(0);
      expect(Number.isNaN(relatorio.nrTotalTriagens)).toBe(false);
      const soma =
        relatorio.distribuicaoUrgencia.BAIXO +
        relatorio.distribuicaoUrgencia.MEDIO +
        relatorio.distribuicaoUrgencia.ALTO;
      expect(soma).toBe(relatorio.nrTotalTriagens);
    });
  });

  // TASK-71 (FIX_6): rota que era "sem mock" (TASK-65 documentou, não corrigiu —
  // era a maior das 3 rotas sem mock nos dois apps: sem `try/catch` na tela, a
  // única que quebrava visivelmente em modo mock). Fixture conferido campo a campo
  // contra `TeleconsultaResponseDto.cs:3-10` (backend-clinica-dotnet) — ver
  // comentário em `src/mocks/teleconsulta.mock.ts::sala`.
  describe('teleconsulta.service (TASK-71, FIX_6)', () => {
    it('criarOuObterSala (POST) executa sem lançar e devolve sala com URL', async () => {
      const res = await criarOuObterSala(1);
      expect(res.idAgendamento).toBe(1);
      expect(typeof res.dsSalaUrl).toBe('string');
      expect(res.dsSalaUrl?.length).toBeGreaterThan(0);
      expect(res.stFallbackManual).toBe(false);
    });

    it('obterSala (GET) executa sem lançar e devolve o estado "sala ainda não criada"', async () => {
      const res = await obterSala(1);
      expect(res.idAgendamento).toBe(1);
      expect(res.dsSalaUrl).toBeNull();
      expect(res.stFallbackManual).toBe(false);
    });

    it('POST e GET no mesmo endpoint não se confundem (despacho por método)', async () => {
      const post = await criarOuObterSala(2);
      const get = await obterSala(2);
      expect(post.dsSalaUrl).not.toBeNull();
      expect(get.dsSalaUrl).toBeNull();
    });
  });
});
