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
import {
  listUsuariosClinica,
  criarUsuarioClinica,
  atualizarUsuarioClinica,
  desativarUsuarioClinica,
  reativarUsuarioClinica,
  trocarSenhaUsuarioClinica,
} from '../src/services/usuarios-clinica.service';
import { listVeterinarios } from '../src/services/veterinarios.service';
import { __resetStoreParaTeste } from '../src/mocks/usuarios-clinica.mock';
import {
  listServicosPreco,
  getServicoPreco,
  criarServicoPreco,
  atualizarServicoPreco,
  reativarServicoPreco,
  desativarServicoPreco,
} from '../src/services/servicos-preco.service';
import { __resetStoreParaTeste as __resetServicosPrecoParaTeste } from '../src/mocks/servicos-preco.mock';
import { lancarCobranca } from '../src/services/cobrancas.service';
import { getResumoFinanceiro } from '../src/services/financeiro.service';

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

  // FM-02 — 7 rotas de UsuariosClinicaController + GET /veterinarios,
  // cadeia real (service -> apiClient -> mock-adapter -> fixture), sem
  // jest.mock de nenhum dos 3. `__resetStoreParaTeste()` porque, diferente
  // do resto deste arquivo, várias `it()`s aqui MUTAM o mesmo store
  // (criar/atualizar/desativar/reativar) e precisam de estado limpo a cada
  // caso, não só entre arquivos de teste.
  describe('usuarios-clinica.service / veterinarios.service (FM-02)', () => {
    beforeEach(() => {
      __resetStoreParaTeste();
    });

    it('listUsuariosClinica executa sem lançar e devolve o seed com o gestor de demonstração', async () => {
      const lista = await listUsuariosClinica();
      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);
      expect(lista.some((u) => u.tpPerfil === 'GESTOR' && u.stAtiva)).toBe(true);
    });

    it('listVeterinarios executa sem lançar e devolve fichas reais', async () => {
      const vets = await listVeterinarios();
      expect(Array.isArray(vets)).toBe(true);
      expect(vets.length).toBeGreaterThan(0);
      expect(typeof vets[0]!.nmVeterinario).toBe('string');
    });

    it('criarUsuarioClinica (VETERINARIO sem idVeterinario) devolve o registro CRIADO, não um eco do corpo enviado', async () => {
      // Se o mock devolvesse só o corpo de entrada (sem id/idClinica/stAtiva/
      // dtCriacao — os campos que só o BACKEND preenche), este teste
      // distingue isso de um handler que realmente monta o DTO de resposta.
      const criado = await criarUsuarioClinica({
        dsEmail: 'contrato.vet@kura.vet',
        dsSenha: 'senha123',
        tpPerfil: 'VETERINARIO',
      });
      expect(typeof criado.id).toBe('number');
      expect(criado.idClinica).toBe(1);
      expect(criado.idVeterinario).toBeNull();
      expect(criado.stAtiva).toBe(true);
      expect(typeof criado.dtCriacao).toBe('string');
      expect(criado.dtAtualizacao).toBeNull();
      // NUNCA ecoa senha/hash — nem no corpo de entrada existiria campo pra
      // isso vazar, mas confirma que ninguém adicionou um por engano.
      expect('dsSenha' in criado).toBe(false);
    });

    it('criarUsuarioClinica com e-mail já em uso por outro ativo rejeita 422 EMAIL_EM_USO', async () => {
      await expect(
        criarUsuarioClinica({
          // Mesmo e-mail do seed (ver usuarios-clinica.mock.ts::buildUsuarios).
          dsEmail: 'felipe.ferrete@kura.vet',
          dsSenha: 'senha123',
          tpPerfil: 'VETERINARIO',
        }),
      ).rejects.toMatchObject({ status: 422, code: 'EMAIL_EM_USO' });
    });

    it('atualizarUsuarioClinica que rebaixaria o ÚLTIMO gestor ativo rejeita 422 SEM_GESTOR_ATIVO', async () => {
      // O seed tem exatamente 1 GESTOR ativo (id 1) — rebaixá-lo pra
      // VETERINARIO tem que reproduzir a MESMA regra que o .NET aplica
      // (UsuariosClinicaService), replicada no mock (ver
      // usuarios-clinica.mock.ts::ficariaSemGestorAtivo). Esta é a mordida
      // que a mensagem do errors.ts fix precisa sobreviver intacta — ver
      // tests/errors.test.ts para a mordida do lado do parser de erro.
      await expect(
        atualizarUsuarioClinica(1, {
          dsEmail: 'felipe.ferrete@kura.vet',
          tpPerfil: 'VETERINARIO',
          idVeterinario: 1,
        }),
      ).rejects.toMatchObject({
        status: 422,
        code: 'SEM_GESTOR_ATIVO',
        message: 'A clínica ficaria sem nenhum gestor ativo.',
      });
    });

    it('atualizarUsuarioClinica sem rebaixar o último gestor executa normalmente', async () => {
      const atualizado = await atualizarUsuarioClinica(2, {
        dsEmail: 'camila.rocha@kura.vet',
        tpPerfil: 'GESTOR', // promove o 2º usuário -- agora há 2 gestores ativos
        idVeterinario: 2,
      });
      expect(atualizado.tpPerfil).toBe('GESTOR');
    });

    // ─── Fix wave pós-G2 (sessão 9) — paridade com GarantirUsuarioAtivo ─────
    // O backend recusa PUT e PUT /senha em usuário DESATIVADO com 422
    // (UsuarioClinicaService.cs:153,:198 -> :288-292, backend-clinica-dotnet
    // @de96c70). O mock da FM-02 não replicava, então o modo mock respondia 200
    // numa operação que o backend real nega — e a tela oferecia os 2 botões na
    // linha inativa. Estes 2 casos travam a paridade dos dois lados.
    async function desativarUsuario1ComSegundoGestor(): Promise<void> {
      // Promove o usuário 2 a GESTOR primeiro: sem isso, desativar o 1 esbarra
      // no invariante do último gestor e o setup falharia por outro motivo.
      await atualizarUsuarioClinica(2, {
        dsEmail: 'camila.rocha@kura.vet',
        tpPerfil: 'GESTOR',
        idVeterinario: 2,
      });
      await desativarUsuarioClinica(1);
    }

    it('atualizarUsuarioClinica num usuário DESATIVADO rejeita 422 — o backend recusa (GarantirUsuarioAtivo)', async () => {
      await desativarUsuario1ComSegundoGestor();
      await expect(
        atualizarUsuarioClinica(1, {
          dsEmail: 'felipe.ferrete@kura.vet',
          tpPerfil: 'GESTOR',
          idVeterinario: 1,
        }),
      ).rejects.toMatchObject({ status: 422, code: 'USUARIO_DESATIVADO' });
    });

    it('trocarSenhaUsuarioClinica num usuário DESATIVADO rejeita 422 — senha nova nunca seria usada', async () => {
      await desativarUsuario1ComSegundoGestor();
      await expect(
        trocarSenhaUsuarioClinica(1, { dsSenha: 'novasenha123' }),
      ).rejects.toMatchObject({ status: 422, code: 'USUARIO_DESATIVADO' });

      // Controle positivo: o MESMO chamado num usuário ATIVO passa — senão o
      // caso acima seria indistinguível de "trocarSenha rejeita sempre".
      await expect(
        trocarSenhaUsuarioClinica(2, { dsSenha: 'novasenha123' }),
      ).resolves.toBeUndefined();
    });

    it('desativarUsuarioClinica (soft delete) que deixaria a clínica sem gestor rejeita 422', async () => {
      await expect(desativarUsuarioClinica(1)).rejects.toMatchObject({
        status: 422,
        code: 'SEM_GESTOR_ATIVO',
      });
    });

    it('desativarUsuarioClinica de um NÃO-gestor executa (204, sem corpo) e o soft delete persiste no GET seguinte', async () => {
      const antes = await desativarUsuarioClinica(2);
      expect(antes).toBeUndefined();

      // Persistência real (lição da TASK-71/FM-04: mock stateless "reverte
      // na tela") -- lendo de novo tem que refletir a escrita anterior.
      //
      // FM-05 (brief §4/§2): o backend real NÃO devolve inativo na lista
      // default -- é preciso incluirInativos:true para enxergar o soft
      // delete no GET seguinte, senão o usuário 2 simplesmente não aparece.
      const listaComInativos = await listUsuariosClinica(true);
      const usuario2 = listaComInativos.find((u) => u.id === 2);
      expect(usuario2?.stAtiva).toBe(false);

      // Controle positivo da 3ª direção de divergência que esta task
      // corrigiu: SEM o flag, o usuário desativado NÃO aparece mais --
      // antes desta task `[...store]` o devolveria de qualquer forma.
      const listaDefault = await listUsuariosClinica();
      expect(listaDefault.some((u) => u.id === 2)).toBe(false);
    });

    it('reativarUsuarioClinica é idempotente: reativar um usuário JÁ ativo também devolve 200 (sem erro)', async () => {
      const res = await reativarUsuarioClinica(1); // id 1 já nasce ativo no seed
      expect(res.stAtiva).toBe(true);
    });

    it('reativarUsuarioClinica de um usuário desativado reativa de verdade e persiste', async () => {
      await desativarUsuarioClinica(2);
      const reativado = await reativarUsuarioClinica(2);
      expect(reativado.stAtiva).toBe(true);

      const lista = await listUsuariosClinica();
      expect(lista.find((u) => u.id === 2)?.stAtiva).toBe(true);
    });

    it('trocarSenhaUsuarioClinica executa sem lançar e não devolve corpo (204)', async () => {
      const res = await trocarSenhaUsuarioClinica(1, { dsSenha: 'novaSenha123' });
      expect(res).toBeUndefined();
    });

    it('trocarSenhaUsuarioClinica com id inexistente rejeita 404', async () => {
      await expect(trocarSenhaUsuarioClinica(999, { dsSenha: 'novaSenha123' })).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  // FM-05 (KURA_BACKLOG_FIN, ciclo metade cliente) — mesma disciplina G4b:
  // exercita a função de verdade (service -> apiClient real -> mock-adapter
  // -> servicos-preco.mock.ts), sem jest.mock do apiClient/mock-adapter.
  describe('servicos-preco.service (FM-05)', () => {
    beforeEach(() => {
      __resetServicosPrecoParaTeste();
    });

    it('listServicosPreco executa sem lançar e devolve o seed com pelo menos 1 serviço ATIVO', async () => {
      const lista = await listServicosPreco();
      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeGreaterThan(0);
      expect(lista.every((s) => s.stAtiva)).toBe(true);
    });

    // Mordida da 3ª direção de divergência (brief §2/§1.7a): SEM
    // incluirInativos, o inativo do seed (id 3) NUNCA aparece -- é o
    // recorte que o backend real faz (ServicoPrecoRepository.cs:24-30).
    it('listServicosPreco(true) traz também o inativo do seed; sem o flag, ele NUNCA aparece', async () => {
      const semFlag = await listServicosPreco();
      expect(semFlag.some((s) => !s.stAtiva)).toBe(false);

      const comFlag = await listServicosPreco(true);
      expect(comFlag.some((s) => !s.stAtiva)).toBe(true);
    });

    it('a lista vem ORDENADA por nmServico (ServicoPrecoRepository.cs:29)', async () => {
      const lista = await listServicosPreco(true);
      const nomes = lista.map((s) => s.nmServico);
      expect(nomes).toEqual([...nomes].sort((a, b) => a.localeCompare(b, 'pt-BR')));
    });

    it('getServicoPreco devolve o serviço mesmo DESATIVADO (Repository.cs:32-35, GET/{id} não filtra StAtiva)', async () => {
      const listaComInativos = await listServicosPreco(true);
      const inativoDoSeed = listaComInativos.find((s) => !s.stAtiva)!;
      const detalhe = await getServicoPreco(inativoDoSeed.id);
      expect(detalhe.stAtiva).toBe(false);
      expect(detalhe.id).toBe(inativoDoSeed.id);
    });

    it('getServicoPreco com id inexistente rejeita 404', async () => {
      await expect(getServicoPreco(999)).rejects.toMatchObject({ status: 404 });
    });

    it('criarServicoPreco devolve o registro CRIADO (id/idClinica/stAtiva/dtCriacao do BACKEND, não eco do corpo)', async () => {
      const criado = await criarServicoPreco({ nmServico: 'Exame de sangue', vlPreco: 80 });
      expect(typeof criado.id).toBe('number');
      expect(criado.idClinica).toBe(1);
      expect(criado.nmServico).toBe('Exame de sangue');
      expect(criado.stAtiva).toBe(true);
      expect(typeof criado.dtCriacao).toBe('string');
      expect(criado.dtAtualizacao).toBeNull();
    });

    it('criarServicoPreco apara (Trim) o nome antes de gravar (ServicoPrecoService.cs:211, NormalizarNome)', async () => {
      const criado = await criarServicoPreco({ nmServico: '   Exame de urina   ', vlPreco: 45 });
      expect(criado.nmServico).toBe('Exame de urina');
    });

    it('criarServicoPreco com nome já em uso por outro ATIVO rejeita 422 NOME_EM_USO', async () => {
      // Mesmo nome do seed (ver servicos-preco.mock.ts::buildServicos), só
      // com capitalização/espaço diferentes -- prova a comparação
      // case-insensitive sobre o nome APARADO (Repository.cs:37-45).
      await expect(
        criarServicoPreco({ nmServico: '  consulta DE ROTINA  ', vlPreco: 200 }),
      ).rejects.toMatchObject({ status: 422, code: 'NOME_EM_USO' });
    });

    it('criarServicoPreco com nome igual ao de um INATIVO NÃO bloqueia (FD-07 não criou UNIQUE de propósito)', async () => {
      // id 3 do seed ("Banho e tosa (descontinuado)") está INATIVO -- o
      // controle positivo é o teste anterior, que prova que o MESMO
      // mecanismo bloqueia quando o outro está ATIVO.
      const criado = await criarServicoPreco({
        nmServico: 'Banho e tosa (descontinuado)',
        vlPreco: 65,
      });
      expect(criado.stAtiva).toBe(true);
    });

    it('atualizarServicoPreco num serviço DESATIVADO rejeita 422 SERVICO_DESATIVADO (GarantirServicoAtivo ANTES de tudo)', async () => {
      const listaComInativos = await listServicosPreco(true);
      const inativoDoSeed = listaComInativos.find((s) => !s.stAtiva)!;
      await expect(
        atualizarServicoPreco(inativoDoSeed.id, { nmServico: 'Novo nome', vlPreco: 10 }),
      ).rejects.toMatchObject({ status: 422, code: 'SERVICO_DESATIVADO' });

      // Controle positivo: o MESMO chamado num serviço ATIVO passa --
      // senão o caso acima seria indistinguível de "atualizar rejeita
      // sempre".
      const ativo = (await listServicosPreco()).find((s) => s.stAtiva)!;
      await expect(
        atualizarServicoPreco(ativo.id, { nmServico: ativo.nmServico, vlPreco: 999 }),
      ).resolves.toMatchObject({ vlPreco: 999 });
    });

    it('atualizarServicoPreco renomeando para um nome em uso por outro ATIVO rejeita 422 NOME_EM_USO', async () => {
      const [primeiro, segundo] = await listServicosPreco();
      await expect(
        atualizarServicoPreco(segundo!.id, { nmServico: primeiro!.nmServico, vlPreco: segundo!.vlPreco }),
      ).rejects.toMatchObject({ status: 422, code: 'NOME_EM_USO' });
    });

    it('atualizarServicoPreco renomeando para o PRÓPRIO nome não dá conflito (excetoId)', async () => {
      const [primeiro] = await listServicosPreco();
      await expect(
        atualizarServicoPreco(primeiro!.id, { nmServico: primeiro!.nmServico, vlPreco: 321 }),
      ).resolves.toMatchObject({ vlPreco: 321 });
    });

    it('desativarServicoPreco (soft delete) executa (204, sem corpo) e o estado persiste no GET seguinte', async () => {
      const [primeiro] = await listServicosPreco();
      const antes = await desativarServicoPreco(primeiro!.id);
      expect(antes).toBeUndefined();

      const detalhe = await getServicoPreco(primeiro!.id);
      expect(detalhe.stAtiva).toBe(false);

      // Controle positivo da 3ª direção de divergência: SEM incluirInativos,
      // ele some da lista.
      const listaDefault = await listServicosPreco();
      expect(listaDefault.some((s) => s.id === primeiro!.id)).toBe(false);
    });

    it('desativarServicoPreco já DESATIVADO faz early-return silencioso (não é erro, 204 de novo)', async () => {
      const listaComInativos = await listServicosPreco(true);
      const inativoDoSeed = listaComInativos.find((s) => !s.stAtiva)!;
      await expect(desativarServicoPreco(inativoDoSeed.id)).resolves.toBeUndefined();
    });

    it('reativarServicoPreco é idempotente: reativar um serviço JÁ ativo também devolve 200 (sem erro)', async () => {
      const [primeiro] = await listServicosPreco();
      const res = await reativarServicoPreco(primeiro!.id);
      expect(res.stAtiva).toBe(true);
    });

    it('reativarServicoPreco de um serviço desativado reativa de verdade e persiste', async () => {
      const [primeiro] = await listServicosPreco();
      await desativarServicoPreco(primeiro!.id);
      const reativado = await reativarServicoPreco(primeiro!.id);
      expect(reativado.stAtiva).toBe(true);

      const listaDefault = await listServicosPreco();
      expect(listaDefault.some((s) => s.id === primeiro!.id)).toBe(true);
    });

    it('reativarServicoPreco com o nome ocupado por outro ATIVO rejeita 422 REATIVACAO_NOME_OCUPADO', async () => {
      // O id 3 do seed nasce INATIVO ("Banho e tosa (descontinuado)").
      // Cria um serviço ATIVO com o MESMO nome antes de tentar reativar.
      const listaComInativos = await listServicosPreco(true);
      const inativoDoSeed = listaComInativos.find((s) => !s.stAtiva)!;
      await criarServicoPreco({ nmServico: inativoDoSeed.nmServico, vlPreco: 1 });

      await expect(reativarServicoPreco(inativoDoSeed.id)).rejects.toMatchObject({
        status: 422,
        code: 'REATIVACAO_NOME_OCUPADO',
      });
    });

    it('reativarServicoPreco com id inexistente rejeita 404', async () => {
      await expect(reativarServicoPreco(999)).rejects.toMatchObject({ status: 404 });
    });
  });

  // cobrancas.mock.ts replica invariantes de CobrancaService.cs (backend-clinica-dotnet
  // @ 94f558d) contra a MESMA store de servicos-preco.mock.ts (cross-mock reference nova
  // desta task, ver ancoragem em cobrancas.mock.ts).
  describe('cobrancas.service (FM-06)', () => {
    beforeEach(() => {
      __resetServicosPrecoParaTeste();
    });

    it('lancarCobranca com idServicoPreco COPIA o preço de tabela para vlCobrado (ResolverValor, CobrancaService.cs:177-183)', async () => {
      const [servico] = await listServicosPreco();
      const cobranca = await lancarCobranca(500, { idServicoPreco: servico!.id });
      expect(cobranca.vlCobrado).toBe(servico!.vlPreco);
      expect(cobranca.idServicoPreco).toBe(servico!.id);
      expect(cobranca.idEventoClinico).toBe(500);
      expect(cobranca.stAtiva).toBe(true);
      expect(typeof cobranca.id).toBe('number');
      expect(typeof cobranca.dtCriacao).toBe('string');
    });

    // Mordida do invariante central da task (D-2): vlCobrado GANHA do preço
    // de tabela quando os dois vêm -- desconto de balcão é lançamento
    // legítimo. Sem este teste, um mock que sempre copiasse o preço (ou
    // sempre usasse o valor informado, ignorando o serviço) passaria as
    // outras asserções e este seria o único a discriminar os dois.
    it('lancarCobranca com idServicoPreco E vlCobrado -- vlCobrado GANHA (override, D-2)', async () => {
      const [servico] = await listServicosPreco();
      const precoDeTabela = servico!.vlPreco;
      const valorComDesconto = precoDeTabela - 10;
      const cobranca = await lancarCobranca(501, {
        idServicoPreco: servico!.id,
        vlCobrado: valorComDesconto,
      });
      expect(cobranca.vlCobrado).toBe(valorComDesconto);
      expect(cobranca.vlCobrado).not.toBe(precoDeTabela);
      // A origem (idServicoPreco) continua gravada -- é rastreabilidade,
      // não fonte de valor em leitura (comentário do DTO real).
      expect(cobranca.idServicoPreco).toBe(servico!.id);
    });

    it('lancarCobranca só com vlCobrado (valor avulso, sem serviço) grava idServicoPreco null', async () => {
      const cobranca = await lancarCobranca(502, { vlCobrado: 37.5 });
      expect(cobranca.vlCobrado).toBe(37.5);
      expect(cobranca.idServicoPreco).toBeNull();
    });

    // ─── I-1 da revisão G2 da FM-06: a cortesia (vlCobrado: 0) ────────────
    //
    // 🔴 O código já estava CERTO nos 5 pontos da cadeia; o que faltava era
    // REDE. A G2 provou por mutação que trocar `??` por `||` em
    // `cobrancas.mock.ts:171` (ou em `LancarCobrancaCard.tsx:184`) mantinha
    // a suíte verde -- `101 passed`, reproduzido pelo maestro. Nenhum dos 24
    // testes da task exercitava o valor zero.
    //
    // ⚠️ Zero não é caso de borda inventado: o backend aceita `>= 0` DE
    // PROPÓSITO e documenta o motivo em ResolverValor
    // (CobrancaService.cs:170-176) -- "cobrança de graça é um lançamento
    // legítimo demais para nascer de um default". Cortesia, retorno sem
    // custo e primeira consulta gratuita são lançamentos reais.
    //
    // 🔴 A CONSEQUÊNCIA MEDIDA de uma regressão aqui é DINHEIRO ERRADO, e é
    // silenciosa: sob `||`, um veterinário que seleciona o serviço e digita
    // `0` (cortesia) enviaria `vlCobrado: undefined`, e o backend COPIA O
    // PREÇO CHEIO da tabela. O tutor é cobrado por algo registrado como
    // gratuito -- sem erro, sem log, sem 4xx.
    //
    // É a regra de ouro deste projeto aplicada a um VALOR em vez de a um
    // detector: *código certo sem gate é código certo até alguém editar.*
    // `0` é o único `number` que `||` descarta e `??` preserva, então a
    // mutação é invisível para qualquer teste que só use valores positivos
    // -- que eram todos os que existiam.
    it('lancarCobranca com vlCobrado ZERO (cortesia) grava 0, não o preço de tabela -- mordida I-1', async () => {
      const [servico] = await listServicosPreco();
      const precoDeTabela = servico!.vlPreco;
      // Controle positivo: só faz sentido asseverar "não copiou o preço" se
      // houvesse um preço diferente de zero para copiar por engano.
      expect(precoDeTabela).toBeGreaterThan(0);

      const cobranca = await lancarCobranca(504, {
        idServicoPreco: servico!.id,
        vlCobrado: 0,
      });

      expect(cobranca.vlCobrado).toBe(0);
      expect(cobranca.vlCobrado).not.toBe(precoDeTabela);
      // A origem continua gravada: cortesia DE UM SERVIÇO é rastreável.
      expect(cobranca.idServicoPreco).toBe(servico!.id);
    });

    it('lancarCobranca com vlCobrado ZERO avulso (sem serviço) grava 0, não cai no fallback -- mordida I-1', async () => {
      const cobranca = await lancarCobranca(505, { vlCobrado: 0 });
      expect(cobranca.vlCobrado).toBe(0);
      expect(cobranca.idServicoPreco).toBeNull();
    });

    it('lancarCobranca com idServicoPreco inexistente rejeita 422 SERVICO_INDISPONIVEL', async () => {
      await expect(lancarCobranca(503, { idServicoPreco: 999 })).rejects.toMatchObject({
        status: 422,
        code: 'SERVICO_INDISPONIVEL',
      });
    });

    // Mordida da race declarada no brief §3.5: o gestor pode desativar um
    // serviço ENQUANTO a tela do veterinário está aberta. Prova que
    // cobrancas.mock.ts lê a MESMA store que servicos-preco.mock.ts edita
    // (cross-mock reference, buscarPorId) -- sem essa referência
    // compartilhada, este teste teria que instanciar um serviço já-inativo
    // "de fábrica" e nunca provaria a race de verdade.
    it('lancarCobranca com serviço DESATIVADO (pelo gestor, na mesma sessão) rejeita 422 SERVICO_DESATIVADO', async () => {
      const [servico] = await listServicosPreco();
      await desativarServicoPreco(servico!.id);

      await expect(
        lancarCobranca(504, { idServicoPreco: servico!.id }),
      ).rejects.toMatchObject({ status: 422, code: 'SERVICO_DESATIVADO' });

      // Controle positivo: o MESMO serviço, antes de ser desativado,
      // lança sem erro -- senão o caso acima seria indistinguível de
      // "lançar rejeita sempre".
      const [outroAtivo] = (await listServicosPreco()).filter((s) => s.id !== servico!.id);
      await expect(
        lancarCobranca(505, { idServicoPreco: outroAtivo!.id }),
      ).resolves.toMatchObject({ idServicoPreco: outroAtivo!.id });
    });

    it('lancarCobranca apara (Trim) e normaliza dsFormaPagamento vazio/espaço para null (NormalizarFormaPagamento, CobrancaService.cs:213-219)', async () => {
      const comEspaco = await lancarCobranca(506, { vlCobrado: 10, dsFormaPagamento: '   ' });
      expect(comEspaco.dsFormaPagamento).toBeNull();

      const comTexto = await lancarCobranca(507, {
        vlCobrado: 10,
        dsFormaPagamento: '  Pix  ',
      });
      expect(comTexto.dsFormaPagamento).toBe('Pix');
    });

    // ⚠️ SÓ testa idEventoClinico=0, não valor negativo: a entrada de
    // mock-adapter.ts (`/\/eventos-clinicos\/\d+\/cobrancas$/`) usa `\d+`,
    // que não casa string com sinal -- um `-1` nunca alcança
    // cobrancas.mock.ts::lancar, o resolveMock() lança "No mock for POST
    // ..." ANTES (medido: era exatamente essa a falha ao tentar este caso,
    // não um 404 com status diferente). Mesma limitação estrutural de TODA
    // entrada `\d+` deste arquivo (ex.: `/pets/\d+$/`) -- não é lacuna
    // desta task, é o dispatch por regex do mock-adapter inteiro. `0` é o
    // maior caso inválido que a regex ainda deixa passar até a função.
    it('lancarCobranca com idEventoClinico=0 (rota malformada que a regex do mock-adapter ainda deixa passar) rejeita 404', async () => {
      await expect(lancarCobranca(0, { vlCobrado: 10 })).rejects.toMatchObject({ status: 404 });
    });

    // 🔴 Divergência DECLARADA (ver "O QUE ESTE MOCK NÃO REPLICA" na
    // ancoragem de cobrancas.mock.ts): o backend real recusaria isto com
    // 400 MensagemSemOrigemDeValor (nem vlCobrado nem idServicoPreco). Este
    // mock não replica as regras de 400 -- LancarCobrancaCard.tsx (com
    // validação escrita à mão, NÃO zod -- ver M-1 da G2)
    // impede esse corpo de sair da UI. Registrado como teste, não como
    // comentário solto, para que a divergência não aumente em silêncio se
    // alguém "corrigir" o mock sem atualizar este teste.
    it('lancarCobranca sem vlCobrado e sem idServicoPreco tem SUCESSO aqui (vlCobrado=0) -- backend real devolveria 400', async () => {
      const cobranca = await lancarCobranca(508, {});
      expect(cobranca.vlCobrado).toBe(0);
      expect(cobranca.idServicoPreco).toBeNull();
    });
  });

  // financeiro.service (FM-07) -- cadeia REAL service -> apiClient -> mock-adapter ->
  // financeiro.mock.ts, mesma disciplina do resto deste arquivo (par service×mock novo entra
  // aqui, SEM jest.mock, ver cabeçalho do arquivo).
  describe('financeiro.service (FM-07)', () => {
    it('getResumoFinanceiro executa sem lançar e ecoa o período pedido', async () => {
      const res = await getResumoFinanceiro('2026-09-01', '2026-09-30');
      expect(res.periodo.de).toBe('2026-09-01');
      expect(res.periodo.ate).toBe('2026-09-30');
      expect(res.periodo.inicioUtc).toBe('2026-09-01T00:00:00.000Z');
      // +1 dia, EXCLUSIVO -- mesma aritmética de FinanceiroService.cs:286-294 (PeriodoResumo.
      // Criar), replicada em financeiro.mock.ts::resolverPeriodo.
      expect(res.periodo.fimExclusivoUtc).toBe('2026-10-01T00:00:00.000Z');
    });

    it('getResumoFinanceiro devolve o período ANTERIOR com a MESMA duração, imediatamente antes, sem sobrepor (PeriodoResumo.Anterior)', async () => {
      // 30 dias (01 a 30 de setembro, inclusive) -- o anterior tem que ser os 30 dias
      // imediatamente antes: 02/08 a 31/08.
      const res = await getResumoFinanceiro('2026-09-01', '2026-09-30');
      expect(res.periodoAnterior.de).toBe('2026-08-02');
      expect(res.periodoAnterior.ate).toBe('2026-08-31');
      // Contíguo: fimExclusivoUtc do anterior == inicioUtc do período pedido.
      expect(res.periodoAnterior.fimExclusivoUtc).toBe(res.periodo.inicioUtc);
    });

    it('getResumoFinanceiro reconcilia: soma do mix == receitaBruta, soma de nrCobrancas do mix == nrCobrancas', async () => {
      const res = await getResumoFinanceiro('2026-09-01', '2026-09-30');
      const somaReceita = res.mixPorServico.reduce((acc, b) => acc + b.receita, 0);
      const somaCobrancas = res.mixPorServico.reduce((acc, b) => acc + b.nrCobrancas, 0);
      // Ponto flutuante: soma exata esperada é 4820.5 -- toBeCloseTo evita falso negativo por
      // erro de arredondamento binário, sem mascarar uma divergência estrutural real.
      expect(somaReceita).toBeCloseTo(res.receitaBruta, 2);
      expect(somaCobrancas).toBe(res.nrCobrancas);
    });

    it('getResumoFinanceiro: de === ate (relatório de um dia) é aceito, não lança', async () => {
      const res = await getResumoFinanceiro('2026-09-15', '2026-09-15');
      expect(res.periodo.de).toBe('2026-09-15');
      expect(res.periodo.ate).toBe('2026-09-15');
      expect(res.periodo.fimExclusivoUtc).toBe('2026-09-16T00:00:00.000Z');
    });
  });
});
