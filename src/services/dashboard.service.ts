import { apiClient } from './api/client';
import type { DashboardHojeResponse, AlertaResponse, RecentAppointmentResponse } from '../types/api';

// ─── Tipos "de fio" (wire shapes) — espelham os DTOs reais do .NET ─────────
// (Kura.Application/DTOs/Dashboard/*.cs). Ficam locais a este service porque
// representam o contrato de rede do backend, não o contrato consumido pela
// UI (esse é o papel de `types/api.ts`).

interface PetResumoApiDto {
  id: number;
  nmPet: string;
  ultimoAtendimento: string;
}

interface AgendamentoResumoApiDto {
  id: number;
  nmPaciente: string;
  dtAgendamento: string;
  dsServico: string;
  stStatus: string;
}

interface DashboardHojeApiDto {
  totalConsultasHoje: number;
  totalAlertasAtivos: number;
  totalRetornosPendentes: number;
  ultimosPetsAtendidos: PetResumoApiDto[];
  proximosAgendamentos: AgendamentoResumoApiDto[];
}

// GET /dashboard/alertas retorna duas formas anônimas distintas (ver
// DashboardService.GetAlertasAsync), unificadas aqui pelo shape comum.
interface AlertaApiDto {
  tipo: 'TEMPERATURA' | 'VACINA_VENCENDO';
  id: number;
  dsTipoAlerta: string;
  dsMensagem: string;
  dtCriacao: string;
}

// ─── Tabela de tradução de status de agendamento ───────────────────────────
// Valores reais possíveis de ST_STATUS (ver CHK_AGEND_STATUS em
// backend-tutor-java V1__initial_schema.sql, tabela compartilhada
// AGENDAMENTO): 'INTENCAO' | 'AGENDADO' | 'CONFIRMADO' | 'REALIZADO' |
// 'CANCELADO' | 'NAO_COMPARECEU'.
// O enum consumido pelo app (RecentAppointmentResponse.sgStatus) não tem
// equivalente 1:1 para todos — mapeamento por aproximação semântica:
//   INTENCAO        -> AGENDADA      (ainda não confirmado, mais próximo de "agendado")
//   AGENDADO        -> AGENDADA
//   CONFIRMADO      -> EM_ANDAMENTO  (não há status "em andamento" real no backend;
//                                     CONFIRMADO é o mais próximo de "processo em curso")
//   REALIZADO       -> CONCLUIDA
//   CANCELADO       -> CANCELADA
//   NAO_COMPARECEU  -> CANCELADA     (não há bucket próprio; tratado como não concluído)
const STATUS_TRANSLATION_TABLE: Record<string, RecentAppointmentResponse['sgStatus']> = {
  INTENCAO: 'AGENDADA',
  AGENDADO: 'AGENDADA',
  CONFIRMADO: 'EM_ANDAMENTO',
  REALIZADO: 'CONCLUIDA',
  CANCELADO: 'CANCELADA',
  NAO_COMPARECEU: 'CANCELADA',
};

function translateStatus(stStatus: string): RecentAppointmentResponse['sgStatus'] {
  return STATUS_TRANSLATION_TABLE[stStatus] ?? 'AGENDADA';
}

// ─── Tabela de tradução de tipo de alerta ──────────────────────────────────
// Combinações reais emitidas por DashboardService.GetAlertasAsync:
//   { tipo: "TEMPERATURA", dsTipoAlerta: "ACIMA_LIMITE" | "ABAIXO_LIMITE" } -> 'IOT_TEMPERATURA'
//   { tipo: "VACINA_VENCENDO", dsTipoAlerta: "PROXIMA_DOSE" }              -> 'VACINA_VENCIDA'
// 'RETORNO_PENDENTE' e 'EXAME_CRITICO' (valores do enum do app) não são
// produzidos pelo backend hoje — não há dado real para mapeá-los.
function translateAlertaTipo(tipo: string): AlertaResponse['dsTipoAlerta'] {
  if (tipo === 'TEMPERATURA') return 'IOT_TEMPERATURA';
  if (tipo === 'VACINA_VENCENDO') return 'VACINA_VENCIDA';
  // TODO: backend pode introduzir novos tipos de alerta no futuro; até lá,
  // qualquer valor desconhecido cai aqui como o mais genérico disponível.
  return 'RETORNO_PENDENTE';
}

function mapHoje(dto: DashboardHojeApiDto): DashboardHojeResponse {
  return {
    metrics: {
      nrConsultasHoje: dto.totalConsultasHoje,
      // nrPacientesAtendidos: backend não expõe essa métrica diretamente;
      // aproximamos pela quantidade de pets distintos na lista de últimos
      // atendidos (mesmo critério usado por DashboardService.GetHojeAsync
      // para montar ultimosPetsAtendidos).
      nrPacientesAtendidos: dto.ultimosPetsAtendidos.length,
      nrAlertasAtivos: dto.totalAlertasAtivos,
      // TODO: backend não rastreia contagem de teleorientações ainda.
      nrTeleorientacoes: 0,
    },
    dailySummary: {
      // TODO: backend não gera um resumo textual do dia; placeholder até existir.
      dsResumo: '',
      dtUltimaAtualizacao: new Date().toISOString(),
    },
  };
}

function mapAlerta(raw: AlertaApiDto): AlertaResponse {
  return {
    id: raw.id,
    dsTipoAlerta: translateAlertaTipo(raw.tipo),
    dsMensagem: raw.dsMensagem,
    // idPet/nmPet: DashboardService.GetAlertasAsync não inclui esses campos
    // em nenhuma das duas formas de alerta — permanecem undefined (opcionais).
    idPet: undefined,
    nmPet: undefined,
    dtCriacao: raw.dtCriacao,
  };
}

function mapRecente(dto: AgendamentoResumoApiDto): RecentAppointmentResponse {
  return {
    id: dto.id,
    // AgendamentoResumoDto.NmPaciente é o nome do pet (mesmo uso em
    // DashboardService.GetHojeAsync ao montar proximosAgendamentos).
    nmPet: dto.nmPaciente,
    // TODO: backend não retorna o nome do tutor neste DTO.
    nmTutor: '',
    dtAgendamento: dto.dtAgendamento,
    nmTipoConsulta: dto.dsServico,
    sgStatus: translateStatus(dto.stStatus),
  };
}

export async function getHoje(): Promise<DashboardHojeResponse> {
  const response = await apiClient.get<DashboardHojeApiDto>('/api/v1/dashboard/hoje');
  return mapHoje(response.data);
}

export async function getAlertas(): Promise<AlertaResponse[]> {
  const response = await apiClient.get<AlertaApiDto[]>('/api/v1/dashboard/alertas');
  return response.data.map(mapAlerta);
}

export async function getRecentes(): Promise<RecentAppointmentResponse[]> {
  const response = await apiClient.get<AgendamentoResumoApiDto[]>('/api/v1/dashboard/recentes');
  return response.data.map(mapRecente);
}
