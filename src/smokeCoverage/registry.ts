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
};
