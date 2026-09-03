// TASK-81 (KURA_BACKLOG_FIX_7). Registry de cobertura do smoke-contratos.sh
// (DevOps-Cloud) para as funções de `src/services/*.service.ts` deste app que fazem
// chamada HTTP real — ver `discover-network-consumers.ts` (mesma pasta) para como a
// LISTA de chaves é derivada do código (não escrita à mão) e `tests/
// smoke-coverage.test.ts` para como este registry é verificado nos dois sentidos:
// (1) toda função descoberta tem que ter entrada aqui, (2) toda entrada aqui tem que
// corresponder a uma função descoberta de verdade (sem órfã) e (3) todo valor
// `coberto` tem que ser um nome de check que EXISTE de fato em
// `DevOps-Cloud/scripts/smoke-contratos.sh` — não uma alegação.
//
// Isto não é o manifesto "documentação que garante o que o código não faz" que já
// reprovou task neste projeto (ver CLAUDE.md, lição do FIX_6): a lista de CHAVES é
// derivada por AST, e o valor `coberto` de cada uma é validado contra o script real
// sempre que `DevOps-Cloud` está disponível localmente (repo irmão OU checkout
// aninhado de CI, ver nota em tests/smoke-coverage.test.ts).
//
// TASK-81, rodada de fix 1: este arquivo (e o walker irmão) vivia em `tests/`, fora
// do type-check e do lint deste repo (G2 Important #5) — movido para `src/` para
// ganhar a mesma rede de segurança estática que mobile-tutor-rn já tinha.
//
// As 3 entradas `naoCoberto` (enviarTranscricao/enviarWhatsApp/getLunaHealth) são
// decisão desta task, não lacuna esquecida — razão em cada entrada.
export type CoverageEntry =
  | { coberto: string }
  | { naoCoberto: string };

export const SMOKE_COVERAGE_REGISTRY: Record<string, CoverageEntry> = {
  // agenda.service.ts
  'agenda.service.ts::getAgenda': { coberto: 'agenda (GET)' },
  'agenda.service.ts::atualizarStatusAgendamento': {
    naoCoberto:
      'FM-04 (KURA_BACKLOG_FIN, ciclo metade cliente) — primeiro PATCH deste repo, ' +
      'PATCH /api/v1/agendamentos/{id}/status (rota ABSOLUTA, fora de /api/v1/agenda; ' +
      'ver AgendaController.cs). smoke-contratos.sh (DevOps-Cloud) não tem check para ' +
      'ela hoje — grep confirmado (`grep -n "agendamentos.*status" scripts/smoke-' +
      'contratos.sh` -> 0 linhas). Side-effecting (grava ST_STATUS/NR_VERSION no ' +
      'Oracle real) e exige controle de concorrência otimista (NrVersion lido de uma ' +
      'chamada anterior) — não é um GET idempotente como os outros checks. Estender ' +
      'smoke-contratos.sh é mudança em DevOps-Cloud, fora do escopo desta task (que só ' +
      'toca mobile-clinica-rn) — candidato a follow-up, provavelmente FM-09 (o gate de ' +
      'contrato do ciclo FIN) ou uma task própria em DevOps-Cloud.',
  },

  // auth.service.ts
  'auth.service.ts::login': { coberto: 'auth/login (clinica)' },
  'auth.service.ts::registerClinica': { coberto: 'auth/register-clinica' },

  // dashboard.service.ts
  'dashboard.service.ts::getHoje': { coberto: 'dashboard/hoje' },
  'dashboard.service.ts::getAlertas': { coberto: 'dashboard/alertas (GET)' },
  'dashboard.service.ts::getRecentes': { coberto: 'dashboard/recentes (GET)' },

  // eventos-clinicos.service.ts
  'eventos-clinicos.service.ts::criarConsulta': {
    coberto: 'eventos-clinicos/consultas (dsObservacao vazio)',
  },
  'eventos-clinicos.service.ts::criarPrescricao': {
    coberto: 'eventos-clinicos/prescricoes (dsObservacao vazio)',
  },
  'eventos-clinicos.service.ts::getMedicamentos': { coberto: 'medicamentos/listar' },
  'eventos-clinicos.service.ts::enviarTranscricao': {
    naoCoberto:
      'Multipart com áudio real + round-trip síncrono pelo Whisper via Luna ' +
      '(EnviarTranscricao, EventosClinicosController.cs:161-178). Decisão desta task: ' +
      'pesado e não-determinístico demais para um smoke test (latência do modelo, ' +
      'exige um arquivo de áudio de verdade no repo ou gerado on-the-fly) — diferente ' +
      'dos outros checks, que são request/response JSON simples. Candidato a follow-up ' +
      'com um fixture de áudio curto versionado, fora do escopo desta task.',
  },
  'eventos-clinicos.service.ts::confirmarSoap': {
    coberto: 'eventos-clinicos/{id}/soap (PUT confirmar)',
  },
  'eventos-clinicos.service.ts::gerarReceituario': {
    coberto: 'eventos-clinicos/{id}/receituario (POST gerar)',
  },
  'eventos-clinicos.service.ts::baixarEAbrirReceituario': {
    coberto: 'eventos-clinicos/{id}/receituario/{idDocumento}/download (GET)',
  },

  // luna.service.ts
  'luna.service.ts::enviarWhatsApp': {
    naoCoberto:
      'Dispara uma mensagem WhatsApp real via Twilio (POST /whatsapp/enviar na Luna, ' +
      'luna.service.ts:24-31) — side-effecting num sistema externo de verdade, mesmo ' +
      'com credenciais Twilio placeholder/dummy neste ambiente (CLAUDE.md confirma que ' +
      'não são credenciais reais, mas o comportamento do SDK diante delas não é ' +
      'garantidamente determinístico para um assert de status code). Decisão desta ' +
      'task: não incluir em smoke-contratos.sh. Também bate no 3º upstream (ver ' +
      'getLunaHealth abaixo) — LUNA_BASE_URL não está modelado neste script hoje.',
  },
  'luna.service.ts::getLunaHealth': {
    naoCoberto:
      'GET /ready (CQ-09: trocado de /health, que só devolve {status:"ok"} e não ' +
      'informa oracle/kura_api nem reflete degradação) bate direto no serviço Python ' +
      'da Luna (kura-luna-ai, porta 8000), não no .NET (kura-api) nem no Java — é um ' +
      'upstream diferente dos dois que este script já sabe autenticar (Bearer ' +
      'clínica/tutor, X-Api-Key Luna->NET). O script não tem hoje uma var ' +
      'LUNA_BASE_URL nem conhece o contrato de prontidão da Luna. Baixo risco (GET ' +
      'simples, sem side-effect) mas fora do escopo desta task — candidato a ' +
      'follow-up que adicione essa 3ª base URL ao script.',
  },
  'luna.service.ts::getRelatorioTriagens': {
    coberto: 'luna/triagens/relatorio (GET, JWT clinica)',
  },

  // pets.service.ts
  'pets.service.ts::listPets': { coberto: 'pets/listar' },
  'pets.service.ts::getPetById': { coberto: 'pets/{id} (GET detalhe, contexto clinica)' },
  'pets.service.ts::getPetTimeline': { coberto: 'pets/timeline (GET, nao mais 500)' },

  // teleconsulta.service.ts
  'teleconsulta.service.ts::criarOuObterSala': { coberto: 'teleconsulta/{id}/sala (POST criar)' },
  'teleconsulta.service.ts::obterSala': { coberto: 'teleconsulta/{id}/sala (GET obter)' },

  // usuarios-clinica.service.ts / veterinarios.service.ts (FM-02) — as 8 entradas
  // abaixo são `naoCoberto`, mesma classe da `atualizarStatusAgendamento` acima:
  // `smoke-contratos.sh` (DevOps-Cloud) não tem check para NENHUMA delas hoje
  // (endpoint novo deste ciclo) e estender aquele script é mudança em outro repo,
  // fora do escopo desta task (que só toca mobile-clinica-rn). Marcar qualquer uma
  // como `coberto: '<nome>'` sem o check existir de verdade seria exatamente a
  // classe de defeito "documentação que garante o que o código não faz" que este
  // projeto já reprovou 5x (CLAUDE.md) — por isso as 3 leituras simples (GET,
  // idempotentes, sem side effect) recebem a MESMA categoria que as 5 de escrita,
  // não uma categoria mais otimista.
  'usuarios-clinica.service.ts::listUsuariosClinica': {
    naoCoberto:
      'GET /api/v1/usuarios-clinica — idempotente, sem side effect, candidato natural a ' +
      'smoke-contratos.sh (mesmo perfil de pets/listar), mas o script real não tem check ' +
      'para ele hoje. Estender smoke-contratos.sh é mudança em DevOps-Cloud, fora do ' +
      'escopo desta task — candidato a follow-up, provavelmente no mesmo ciclo que ' +
      'endereçar atualizarStatusAgendamento (FM-04) acima.',
  },
  'usuarios-clinica.service.ts::getUsuarioClinica': {
    naoCoberto:
      'GET /api/v1/usuarios-clinica/{id} — idempotente, sem side effect. Mesma razão de ' +
      'listUsuariosClinica acima: sem check hoje, extensão de DevOps-Cloud fora do ' +
      'escopo desta task.',
  },
  'usuarios-clinica.service.ts::criarUsuarioClinica': {
    naoCoberto:
      'POST /api/v1/usuarios-clinica — side-effecting (grava USUARIO_CLINICA no Oracle ' +
      'real, com regra de negócio de e-mail único por clínica). Sem check hoje em ' +
      'smoke-contratos.sh; estender é mudança em DevOps-Cloud, fora do escopo desta task.',
  },
  'usuarios-clinica.service.ts::atualizarUsuarioClinica': {
    naoCoberto:
      'PUT /api/v1/usuarios-clinica/{id} — side-effecting, e a regra de negócio mais ' +
      'sensível deste endpoint (nunca deixar a clínica sem nenhum GESTOR ativo, ver ' +
      'tests/mock-contract-audit.test.ts) exigiria um smoke test com SETUP de dado ' +
      'específico (2 gestores, rebaixar um) para ser útil — mais complexo que os checks ' +
      'request/response simples que o script hoje contém. Sem check hoje; extensão fora ' +
      'do escopo desta task.',
  },
  'usuarios-clinica.service.ts::desativarUsuarioClinica': {
    naoCoberto:
      'DELETE /api/v1/usuarios-clinica/{id} — side-effecting (soft delete real), mesma ' +
      'regra de "não pode deixar a clínica sem gestor" do PUT acima. Sem check hoje; ' +
      'extensão de DevOps-Cloud fora do escopo desta task.',
  },
  'usuarios-clinica.service.ts::reativarUsuarioClinica': {
    naoCoberto:
      'POST /api/v1/usuarios-clinica/{id}/reativacao — side-effecting, idempotente por ' +
      'contrato (reativar já-ativo também dá 200) mas ainda assim sem check hoje em ' +
      'smoke-contratos.sh — extensão fora do escopo desta task.',
  },
  'usuarios-clinica.service.ts::trocarSenhaUsuarioClinica': {
    naoCoberto:
      'PUT /api/v1/usuarios-clinica/{id}/senha — side-effecting (grava hash novo real) e ' +
      'transporta segredo (dsSenha) no corpo — mesma cautela de enviarWhatsApp/dado ' +
      'sensível acima quanto a incluir em um script versionado sem pensar no dado de ' +
      'teste. Sem check hoje; extensão de DevOps-Cloud fora do escopo desta task.',
  },
  'veterinarios.service.ts::listVeterinarios': {
    naoCoberto:
      'GET /api/v1/veterinarios — idempotente, sem side effect, `[Authorize]` simples ' +
      '(não SomenteGestor). Mesma razão de listUsuariosClinica: sem check hoje em ' +
      'smoke-contratos.sh, extensão de DevOps-Cloud fora do escopo desta task.',
  },

  // servicos-preco.service.ts (FM-05, ciclo FIN) — as 6 entradas abaixo são
  // `naoCoberto`, mesma classe das entradas de usuarios-clinica.service.ts
  // acima: `smoke-contratos.sh` (DevOps-Cloud) não tem check para NENHUMA
  // delas hoje (endpoint novo deste ciclo, FD-09) e estender aquele script
  // é mudança em outro repo, fora do escopo desta task (que só toca
  // mobile-clinica-rn).
  'servicos-preco.service.ts::listServicosPreco': {
    naoCoberto:
      'GET /api/v1/servicos-preco — idempotente, sem side effect, candidato natural a ' +
      'smoke-contratos.sh (mesmo perfil de listUsuariosClinica/pets/listar), mas o script ' +
      'real não tem check para ele hoje. Estender smoke-contratos.sh é mudança em ' +
      'DevOps-Cloud, fora do escopo desta task.',
  },
  'servicos-preco.service.ts::getServicoPreco': {
    naoCoberto:
      'GET /api/v1/servicos-preco/{id} — idempotente, sem side effect. Mesma razão de ' +
      'listServicosPreco acima: sem check hoje, extensão de DevOps-Cloud fora do escopo ' +
      'desta task.',
  },
  'servicos-preco.service.ts::criarServicoPreco': {
    naoCoberto:
      'POST /api/v1/servicos-preco — side-effecting (grava SERVICO_PRECO no Oracle real, ' +
      'com regra de negócio de nome único entre ATIVOS por clínica). Sem check hoje em ' +
      'smoke-contratos.sh; estender é mudança em DevOps-Cloud, fora do escopo desta task.',
  },
  'servicos-preco.service.ts::atualizarServicoPreco': {
    naoCoberto:
      'PUT /api/v1/servicos-preco/{id} — side-effecting, e a regra de negócio mais sensível ' +
      'deste endpoint (recusar com 422 tanto nome duplicado quanto serviço desativado, ver ' +
      'tests/mock-contract-audit.test.ts) exigiria um smoke test com SETUP de dado específico ' +
      'para ser útil — mais complexo que os checks request/response simples que o script hoje ' +
      'contém. Sem check hoje; extensão fora do escopo desta task.',
  },
  'servicos-preco.service.ts::reativarServicoPreco': {
    naoCoberto:
      'POST /api/v1/servicos-preco/{id}/reativacao — side-effecting, idempotente por ' +
      'contrato (reativar já-ativo também dá 200) mas ainda assim sem check hoje em ' +
      'smoke-contratos.sh — extensão fora do escopo desta task.',
  },
  'servicos-preco.service.ts::desativarServicoPreco': {
    naoCoberto:
      'DELETE /api/v1/servicos-preco/{id} — side-effecting (soft delete real). Sem check ' +
      'hoje; extensão de DevOps-Cloud fora do escopo desta task.',
  },

  // cobrancas.service.ts (FM-06, ciclo FIN)
  'cobrancas.service.ts::lancarCobranca': {
    naoCoberto:
      'POST /api/v1/eventos-clinicos/{id}/cobrancas — side-effecting (grava COBRANCA no ' +
      'Oracle real, com a regra de negócio mais sensível deste endpoint: 422 para serviço ' +
      'de preço inexistente/de outra clínica OU DESATIVADO — ver CobrancaService.cs:190-211, ' +
      'backend-clinica-dotnet @ 94f558d). grep confirmado (`grep -n "cobranca" scripts/' +
      'smoke-contratos.sh` -> 0 linhas). Estender smoke-contratos.sh é mudança em ' +
      'DevOps-Cloud, fora do escopo desta task (que só toca mobile-clinica-rn).',
  },

  // financeiro.service.ts (FM-07, ciclo FIN)
  'financeiro.service.ts::getResumoFinanceiro': {
    naoCoberto:
      'GET /api/v1/financeiro/resumo — idempotente, sem side effect (é só LEITURA agregada ' +
      'sobre COBRANCA), mas exige um GESTOR autenticado (SomenteGestor no controller) e um ' +
      'par de/ate válido — o script hoje só sabe autenticar (chamar/chamar_apikey), não ' +
      'compor query string. grep confirmado (`grep -n "financeiro" scripts/smoke-contratos.sh` ' +
      '-> 0 linhas, DevOps-Cloud @ verificado nesta task com o repo irmão clonado ao lado). ' +
      'Estender smoke-contratos.sh é mudança em DevOps-Cloud, fora do escopo desta task (que ' +
      'só toca mobile-clinica-rn) — mesma classe de decisão de agenda.service.ts:: ' +
      'atualizarStatusAgendamento e cobrancas.service.ts::lancarCobranca acima.',
  },
};
