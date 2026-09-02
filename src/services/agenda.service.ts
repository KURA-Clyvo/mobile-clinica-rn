import { apiClient } from './api/client';
import type { AgendaQuery, AgendamentoResponse } from '../types/api';
import { translateStatusAgendamento } from '../utils/statusAgendamento';

// ─── Tipos "de fio" (wire shapes) — espelham os DTOs reais do .NET ─────────
// (Kura.Application/DTOs/Agenda/AgendaResponseDto.cs e AgendamentoItemDto.cs).
// Ficam locais a este service porque representam o contrato de rede do
// backend, não o contrato consumido pela UI (esse é o papel de `types/api.ts`).

// TASK-65 (FIX_5): exportadas de propósito — mesmo racional de
// dashboard.service.ts/PetResumoApiDto (ver comentário lá). O mock
// (`agenda.mock.ts`) precisa devolver este shape RAW, não `AgendamentoResponse`.
export interface AgendamentoItemApiDto {
  idAgendamento: number;
  dtAgendamento: string;
  duracaoMinutos: number;
  nmTutor: string;
  nmPet: string;
  idVeterinario: number;
  nmVeterinario: string;
  dsTipoConsulta: string;
  dsStatus: string;
  nrVersion: number;
}

export interface AgendaApiResponseDto {
  dataInicio: string;
  dataFim: string;
  agendamentos: AgendamentoItemApiDto[];
}

// FM-04 (revisão pós-medição do maestro): a tradução de status deixou de
// morar aqui — dashboard.service.ts tinha a MESMA tabela, redigitada à mão,
// e tinha divergido (CONFIRMADO->'EM_ANDAMENTO', NAO_COMPARECEU->'CANCELADA'
// — o mesmo achado nº 2 desta task, só que entre telas). Ver
// utils/statusAgendamento.ts, fonte única agora compartilhada com
// dashboard.service.ts.

// ─── Máquina de estados do PATCH de status ─────────────────────────────────
// Espelha, do lado cliente, AgendaService.TransicoesPermitidas
// (backend-clinica-dotnet/src/Kura.Application/Services/AgendaService.cs) —
// decide que ações o menu contextual da agenda pode oferecer a partir do
// status CRU (dsStatusOrigem) de um agendamento. Deliberadamente reescrita
// aqui, não importada (os dois repos não compartilham código) — se o backend
// mudar esta tabela sem avisar, o pior caso é o app oferecer uma transição
// que o servidor recusa com 422 (falha visível, não corrupção silenciosa).
//
// Chave = status de ORIGEM cru (não o sgStatus traduzido — ver comentário em
// AgendamentoResponse.dsStatusOrigem, types/api.ts, sobre por que a origem
// crua importa: INTENCAO e AGENDADO colapsam no mesmo bucket 'AGENDADA' mas
// têm destinos diferentes).
export type StatusDestino = 'REALIZADO' | 'CANCELADO' | 'NAO_COMPARECEU' | 'CONFIRMADO';

const TRANSICOES_PERMITIDAS: Record<string, StatusDestino[]> = {
  INTENCAO: ['CANCELADO'],
  AGENDADO: ['CONFIRMADO', 'REALIZADO', 'CANCELADO', 'NAO_COMPARECEU'],
  CONFIRMADO: ['REALIZADO', 'CANCELADO', 'NAO_COMPARECEU'],
  REALIZADO: [],
  CANCELADO: [],
  NAO_COMPARECEU: [],
};

// Estado de origem fora do mapa (coluna divergiu do CHECK) é tratado como sem
// transição nenhuma, não como erro — o menu simplesmente não aparece. Ver a
// mesma postura ("um mapa não reconhecer a origem é sinal de que o mapa
// envelheceu") do lado .NET, onde a resposta é recusar (RegraDeNegocioException);
// aqui, sem uma leitura fresca de servidor, a resposta segura é não oferecer
// ação nenhuma.
export function getTransicoesPermitidas(dsStatusOrigem: string): StatusDestino[] {
  return TRANSICOES_PERMITIDAS[dsStatusOrigem] ?? [];
}

function mapAgendamentoItem(dto: AgendamentoItemApiDto): AgendamentoResponse {
  return {
    id: dto.idAgendamento,
    dtInicio: dto.dtAgendamento,
    nrDuracaoMinutos: dto.duracaoMinutos,
    sgStatus: translateStatusAgendamento(dto.dsStatus),
    dsStatusOrigem: dto.dsStatus,
    nrVersion: dto.nrVersion,
    pet: {
      // TODO: AgendamentoItemDto não traz o id do pet, só o nome.
      id: 0,
      nmPet: dto.nmPet,
      // TODO: AgendamentoItemDto não traz espécie do pet.
      nmEspecie: '',
      // TODO: AgendamentoItemDto não traz raça do pet.
      nmRaca: '',
    },
    tutor: {
      // TODO: AgendamentoItemDto não traz o id do tutor, só o nome.
      id: 0,
      nmTutor: dto.nmTutor,
      // TODO: AgendamentoItemDto não traz telefone do tutor.
      dsTelefone: '',
    },
    veterinario: {
      id: dto.idVeterinario,
      nmVeterinario: dto.nmVeterinario,
      // TODO: AgendamentoItemDto não traz o CRMV do veterinário.
      nrCRMV: '',
    },
    // dsObservacao: AgendamentoItemDto não traz observações — permanece
    // undefined (campo opcional).
    dsObservacao: undefined,
  };
}

export async function getAgenda(query: AgendaQuery): Promise<AgendamentoResponse[]> {
  const response = await apiClient.get<AgendaApiResponseDto>('/api/v1/agenda', { params: query });
  return response.data.agendamentos.map(mapAgendamentoItem);
}

export interface AtualizarStatusAgendamentoRequest {
  dsStatus: StatusDestino;
  nrVersion: number;
  dsObservacao?: string;
}

// FM-04 — primeiro PATCH da história deste repo (medido: `grep -rn "apiClient\.
// \(get\|post\|put\|patch\|delete\)("` dava 20 ocorrências, 0 `.patch(`, antes
// desta função). Rota ABSOLUTA (`~/api/v1/agendamentos/{id}/status`, fora de
// `/api/v1/agenda`) — ver AgendaController.cs, `[HttpPatch("~/api/v1/
// agendamentos/{id:long}/status")]`. Corpo serializado em camelCase pelo
// System.Text.Json (sem policy customizada no projeto .NET), então `req` (já
// camelCase em TS) vai como está, sem mapper de saída.
export async function atualizarStatusAgendamento(
  idAgendamento: number,
  req: AtualizarStatusAgendamentoRequest,
): Promise<AgendamentoResponse> {
  const response = await apiClient.patch<AgendamentoItemApiDto>(
    `/api/v1/agendamentos/${idAgendamento}/status`,
    req,
  );
  return mapAgendamentoItem(response.data);
}
