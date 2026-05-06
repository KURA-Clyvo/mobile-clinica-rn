// ─── Auth ─────────────────────────────────────────────────────
export interface LoginRequest {
  dsEmail: string;
  dsSenha: string;
}
export interface LoginResponse {
  accessToken: string;
  expiresAt: string;
}

export interface RegisterClinicaRequest {
  nmClinica: string;
  dsCnpj: string;
  dsEmail: string;
  dsTelefone: string;
  dsEndereco: string;
  nmVeterinarioAdmin: string;
  nrCRMV: string;
  dsEmailAdmin: string;
  dsSenhaAdmin: string;
}
export interface RegisterClinicaResponse {
  idClinica: number;
  idVeterinarioAdmin: number;
  accessToken: string;
  expiresAt: string;
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
export interface AgendamentoResponse {
  id: number;
  dtInicio: string;
  nrDuracaoMinutos: number;
  sgStatus: 'AGENDADA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
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
export interface TriagensRelatorioResponse {
  nrTotalTriagens: number;
  distribuicaoUrgencia: {
    BAIXO: number;
    MEDIO: number;
    ALTO: number;
    CRITICO: number;
  };
  nrEncaminhadasParaVet: number;
}

// ─── Luna (Python — chamada direta) ───────────────────────────
export interface WhatsAppEnvioRequest {
  idPet: number;
  idTutor: number;
  dsMensagem: string;
  attachments?: Array<{
    tipo: 'IMAGEM' | 'PDF' | 'PRESCRICAO';
    url: string;
  }>;
}
export interface WhatsAppEnvioResponse {
  idEnvio: number;
  dtEnvio: string;
  sgStatus: 'AGENDADO' | 'ENVIADO' | 'FALHOU';
}

export interface LunaHealthResponse {
  sgStatus: 'UP' | 'DOWN' | 'DEGRADED';
  dtUltimaVerificacao: string;
  servicos: {
    twilio: 'UP' | 'DOWN';
    oracle: 'UP' | 'DOWN';
    visaoComputacional: 'UP' | 'DOWN';
  };
}

// ─── Erros normalizados ───────────────────────────────────────
export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: Record<string, string[]>;
}
