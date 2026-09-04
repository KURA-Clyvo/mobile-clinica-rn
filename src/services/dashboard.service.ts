import { apiClient } from './api/client';
import type { DashboardHojeResponse, AlertaResponse, RecentAppointmentResponse } from '../types/api';
import { translateStatusAgendamento } from '../utils/statusAgendamento';

// ─── Tipos "de fio" (wire shapes) — espelham os DTOs reais do .NET ─────────
// (Kura.Application/DTOs/Dashboard/*.cs). Ficam locais a este service porque
// representam o contrato de rede do backend, não o contrato consumido pela
// UI (esse é o papel de `types/api.ts`).

// TASK-65 (FIX_5): exportadas de propósito — o mock (`dashboard.mock.ts`) simula a
// fronteira HTTP deste service, então tem que devolver o shape de ENTRADA das
// funções (o corpo cru que viria do .NET), não o shape de SAÍDA
// (DashboardHojeResponse/AlertaResponse/RecentAppointmentResponse). Mesmo padrão
// da TASK-64 (RegisterInviteApiResponse em auth.service.ts, mobile-tutor-rn):
// acoplar o mock ao service é correto aqui, não acidental.
export interface PetResumoApiDto {
  id: number;
  nmPet: string;
  ultimoAtendimento: string;
}

export interface AgendamentoResumoApiDto {
  id: number;
  nmPaciente: string;
  dtAgendamento: string;
  dsServico: string;
  stStatus: string;
}

export interface DashboardHojeApiDto {
  totalConsultasHoje: number;
  totalAlertasAtivos: number;
  totalRetornosPendentes: number;
  ultimosPetsAtendidos: PetResumoApiDto[];
  proximosAgendamentos: AgendamentoResumoApiDto[];
  // FM-08 (ciclo FIN) — 2 campos NOVOS, `backend-clinica-dotnet` `main` @ 81ac01c (task
  // FD-17, suíte 672/0). Substituem as 2 aproximações erradas de mapHoje() abaixo:
  //   totalPacientesAtendidosHoje: pets DISTINTOS com evento HOJE, SEM teto (o antigo
  //     `ultimosPetsAtendidos.length` saturava em 5 porque a lista é `.Take(5)` E não
  //     filtra por data — "hoje" era mentira dupla).
  //   totalTeleorientacoesHoje: AGENDAMENTO com StTeleconsulta=true e DtInicioSessao de
  //     hoje. 🔴 Conta SALAS CRIADAS hoje, NÃO sessões realizadas — DT_INICIO_SESSAO é
  //     "timestamp de criação da sala" (comentário da coluna, migration V10, medido pela
  //     G2 da FD-17). Não rotular como "sessões realizadas"/"atendimentos concluídos".
  totalPacientesAtendidosHoje: number;
  totalTeleorientacoesHoje: number;
}

// GET /dashboard/alertas retorna duas formas anônimas distintas (ver
// DashboardService.GetAlertasAsync), unificadas aqui pelo shape comum.
export interface AlertaApiDto {
  tipo: 'TEMPERATURA' | 'VACINA_VENCENDO';
  id: number;
  dsTipoAlerta: string;
  dsMensagem: string;
  dtCriacao: string;
}

// FM-04 (revisão pós-medição do maestro, 2026-09-02): esta tabela era uma
// CÓPIA redigitada à mão da mesma tradução em agenda.service.ts — e tinha
// divergido dela: CONFIRMADO caía em 'EM_ANDAMENTO' e NAO_COMPARECEU em
// 'CANCELADA' aqui, enquanto a agenda (corrigida antes nesta mesma task)
// já dizia 'CONFIRMADA'/'NAO_COMPARECEU' para o MESMO agendamento — duas
// telas, o mesmo dado, rótulos diferentes. Ver utils/statusAgendamento.ts,
// fonte única agora compartilhada pelos dois services.

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
      // FM-08 — lê o campo próprio do backend (totalPacientesAtendidosHoje), não mais
      // `ultimosPetsAtendidos.length`. O antigo `.length` saturava em 5 (a lista é
      // `.Take(5)`, sem filtro de data) — ver comentário do DTO acima.
      // `ultimosPetsAtendidos` continua existindo e sendo usado só para exibir "últimos
      // pets atendidos" (lista, não contador) — não remover.
      nrPacientesAtendidos: dto.totalPacientesAtendidosHoje,
      nrAlertasAtivos: dto.totalAlertasAtivos,
      // FM-08 — lê o campo próprio do backend, substitui o `0` hardcoded (o TODO antigo
      // estava desatualizado: o backend passou a rastrear, ver comentário do DTO acima).
      nrTeleorientacoes: dto.totalTeleorientacoesHoje,
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
    sgStatus: translateStatusAgendamento(dto.stStatus),
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
