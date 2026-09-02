// ─── Auth ─────────────────────────────────────────────────────
export interface LoginRequest {
  dsEmail: string;
  dsSenha: string;
}
export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
  usuario: VeterinarioResponse;
}

export interface RegisterClinicaRequest {
  nmClinica: string;
  nrCnpj: string;
  nmRazaoSocial?: string;
  dsEndereco: string;
  nmCidade: string;
  sgUf: string;
  nrCep: string;
  nrTelefone?: string;
  dsEmail: string;
  dsEmailAcesso: string;
  dsSenha: string;
  nmVeterinarioAdmin: string;
  nrCRMV: string;
}
export interface RegisterClinicaResponse {
  idClinica: number;
  idVeterinarioAdmin: number;
  accessToken: string;
  expiresAt: string;
  usuario: VeterinarioResponse;
}

// ─── Dashboard ────────────────────────────────────────────────
export interface DashboardHojeResponse {
  metrics: {
    nrConsultasHoje: number;
    nrPacientesAtendidos: number;
    nrAlertasAtivos: number;
    nrTeleorientacoes: number;
  };
  dailySummary: {
    dsResumo: string;
    dtUltimaAtualizacao: string;
  };
}

export interface AlertaResponse {
  id: number;
  dsTipoAlerta: 'VACINA_VENCIDA' | 'RETORNO_PENDENTE' | 'EXAME_CRITICO' | 'IOT_TEMPERATURA';
  dsMensagem: string;
  idPet?: number;
  nmPet?: string;
  dtCriacao: string;
}

export interface RecentAppointmentResponse {
  id: number;
  nmPet: string;
  nmTutor: string;
  dtAgendamento: string;
  nmTipoConsulta: string;
  sgStatus: 'AGENDADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
}

// ─── Agenda ───────────────────────────────────────────────────
export interface AgendaQuery {
  dataInicio: string;
  dataFim: string;
  veterinarioId?: number;
}
// FM-04: valores de sgStatus são o bucket TRADUZIDO (ver STATUS_TRANSLATION_TABLE
// em agenda.service.ts). 'EM_ANDAMENTO' foi removido daqui — era um artefato da
// tradução antiga, que não tinha bucket próprio para CONFIRMADO/NAO_COMPARECEU e
// aproximava os dois por semântica. Hoje os dois têm rótulo e tone próprios.
export interface AgendamentoResponse {
  id: number;
  dtInicio: string;
  nrDuracaoMinutos: number;
  sgStatus: 'AGENDADA' | 'CONFIRMADA' | 'CONCLUIDA' | 'CANCELADA' | 'NAO_COMPARECEU';
  // FM-04: valor CRU de ST_STATUS (INTENCAO|AGENDADO|CONFIRMADO|REALIZADO|CANCELADO|
  // NAO_COMPARECEU), não traduzido. Necessário porque a máquina de estados do
  // PATCH /agendamentos/{id}/status (AgendaService.TransicoesPermitidas, backend
  // .NET) decide os destinos possíveis a partir do status de ORIGEM real — e
  // sgStatus (traduzido) colapsa INTENCAO e AGENDADO no mesmo bucket 'AGENDADA',
  // que têm transições DIFERENTES no backend (INTENCAO só permite CANCELADO;
  // AGENDADO permite os 4 destinos). Usar sgStatus para decidir o menu ofereceria
  // ações inválidas caso uma linha INTENCAO algum dia apareça na agenda.
  dsStatusOrigem: string;
  // FM-04: exigido pelo corpo do PATCH (controle de concorrência otimista,
  // AtualizarStatusAgendamentoDto.NrVersion no .NET) — sem isto não há como montar
  // a requisição de mudança de status.
  nrVersion: number;
  pet: {
    id: number;
    nmPet: string;
    nmEspecie: string;
    nmRaca: string;
  };
  tutor: {
    id: number;
    nmTutor: string;
    dsTelefone: string;
  };
  veterinario: {
    id: number;
    nmVeterinario: string;
    nrCRMV: string;
  };
  dsObservacao?: string;
}

// ─── Pets ─────────────────────────────────────────────────────
export interface TutorMini {
  id: number;
  nmTutor: string;
  dsTelefone: string;
  dsEmail: string;
}

export interface PetResponse {
  id: number;
  nmPet: string;
  nmEspecie: string;
  nmRaca: string;
  dtNascimento: string;
  sgSexo: 'M' | 'F';
  sgPorte: 'P' | 'M' | 'G' | 'GG';
  tutores: TutorMini[];
}

export interface TimelineEventResponse {
  idEventoClinico: number;
  nmTipo: 'CONSULTA' | 'VACINA' | 'PRESCRICAO' | 'EXAME' | 'TELEORIENTACAO';
  dtEvento: string;
  dsObservacao: string;
  nmVeterinario?: string;
}

// ─── Eventos Clínicos (POST) ──────────────────────────────────
export interface ConsultaRequest {
  idPet: number;
  idVeterinario: number;
  dtConsulta: string;
  dsMotivo: string;
  dsAnamnese?: string;
  dsExameFisico?: string;
  dsDiagnostico?: string;
  dsObservacao?: string;
}
export interface ConsultaResponse {
  idEventoClinico: number;
  idConsulta: number;
}

export interface VacinaRequest {
  idPet: number;
  idVeterinario: number;
  dtEvento: string;
  nmVacina: string;
  nrLote: string;
  dtProximaDose: string;
}

export interface PrescricaoRequest {
  idPet: number;
  idVeterinario: number;
  dtEvento: string;
  idMedicamento: number;
  dsPosologia: string;
  nrDuracaoDias: number;
  dsObservacao?: string;
}

// ─── Medicamentos ─────────────────────────────────────────────
export interface MedicamentosQuery {
  busca?: string;
  page?: number;
  pageSize?: number;
}
export interface MedicamentoResponse {
  id: number;
  nmMedicamento: string;
  dsPrincipioAtivo: string;
  dsConcentracao: string;
  dsApresentacao: string;
}
export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

// ─── Veterinários ─────────────────────────────────────────────
export interface VeterinarioResponse {
  id: number;
  nmVeterinario: string;
  nrCRMV: string;
  dsEmail: string;
  dsTelefone?: string;
  dsFotoUrl?: string;
  dsEspecialidade?: string;
  dsBio?: string;
}

// ─── Luna (.NET — relatório agregado) ────────────────────────
export interface TriagensRelatorioQuery {
  dataInicio: string;
  dataFim: string;
}

// Tipo INTERNO do app — o que luna.tsx e os hooks consomem. Nomes de campo herdados
// da versão pré-CQ-09 (não são os nomes que o .NET realmente emite — ver
// TriagensRelatorioApiResponse abaixo). CQ-09 removeu `CRITICO`: nenhum produtor da
// cadeia (Luna Python / .NET) emite esse nível de urgência — era UI para dado
// inexistente.
export interface TriagensRelatorioResponse {
  nrTotalTriagens: number;
  distribuicaoUrgencia: {
    BAIXO: number;
    MEDIO: number;
    ALTO: number;
  };
  nrEncaminhadasParaVet: number;
}

// Shape de FIO real emitido por GET /api/v1/luna/triagens/relatorio (.NET). CQ-09:
// divergia dos 3 nomes de campo E do vocabulário de urgência que o app lia
// (nrTotalTriagens/distribuicaoUrgencia/nrEncaminhadasParaVet, ALTO/MEDIO/BAIXO) — a
// tela sempre mostrava zero em modo real porque o parser antigo simplesmente não
// encontrava essas chaves. luna.service.ts traduz este tipo para
// TriagensRelatorioResponse (camada anti-corrupção, mesmo padrão da TASK-55: tipo de
// fio ≠ tipo interno, a tradução vive no service, não vaza para a tela).
// `porUrgencia` é `Record<string, number>` (não union literal ALTA/MEDIA/BAIXA) de
// propósito: chaves que a API real não deveria emitir (ex. um eventual 'CRITICA') são
// ignoradas pelo tradutor em vez de quebrar o parse.
// LIMITE DECLARADO: nomes de campo e vocabulário herdados do ledger de investigação de
// sessões anteriores (kura-luna-ai/backend-clinica-dotnet), não reverificados contra o
// .NET real nesta sessão — nenhum dos dois repos está clonado nesta máquina (D-2).
export interface TriagensRelatorioApiResponse {
  totalTriagens: number;
  porUrgencia: Record<string, number>;
  encaminhadasParaVet: number;
}

// ─── Luna (Python — chamada direta) ───────────────────────────
// Espelha EnviarWhatsAppRequest/-Response de luna/src/web/routers/whatsapp.py (TASK-06).
export interface WhatsAppEnvioRequest {
  telefone: string;
  mensagem: string;
  tipo: 'resumo_consulta' | 'receituario' | 'lembrete' | 'manual';
}
export interface WhatsAppEnvioResponse {
  status: string;
  sid?: string | null;
}

// GET /health — liveness simples da Luna (ex. {status:'ok'}). CQ-09: não é o endpoint
// que informa oracle/kura_api nem reflete degradação parcial — isso é GET /ready (ver
// LunaReadyResponse abaixo). O guard antigo desta tela testava uma chave (`sgStatus`)
// que nunca existiu em nenhum dos dois endpoints reais — resultado medido: a tela
// sempre mostrava "Offline" em modo real, mesmo com a Luna no ar.
// CQ-09 fix wave (G2 Minor-2): sem consumidor em código hoje — luna.service.ts/
// luna.tsx passaram a bater em GET /ready, não GET /health. Mantido de propósito
// como documentação do endpoint de liveness real (existe, só não é o que a tela usa
// para os cards de sub-serviço) — não é tipo morto por engano, é registro do
// contrato para quem precisar de liveness simples no futuro.
export interface LunaHealthResponse {
  status: string;
}

// GET /ready — corpo real: {status, oracle, kura_api}. CQ-09/E14 (ledger): esta rota
// devolve HTTP 503 (corpo ainda válido, não falha de rede) quando algo está
// degradado — luna.service.ts trata isso via `validateStatus`, não deixa o 503 cair no
// catch genérico (ver JSDoc de getLunaHealth).
// LIMITE DECLARADO: o tipo exato de `oracle`/`kura_api` (enum? boolean? string livre?)
// não foi reverificado contra a Luna real nesta sessão — kura-luna-ai não está clonado
// nesta máquina. Tratados aqui como string opaca; quem decide "está up?" compara de
// forma defensiva e case-insensitive (ver isServicoUp em luna.tsx), não assume um
// literal específico.
export interface LunaReadyResponse {
  status: string;
  oracle: string;
  kura_api: string;
}

// ─── Erros normalizados ───────────────────────────────────────
export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
}
