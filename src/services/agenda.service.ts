import { apiClient } from './api/client';
import type { AgendaQuery, AgendamentoResponse } from '../types/api';

// ─── Tipos "de fio" (wire shapes) — espelham os DTOs reais do .NET ─────────
// (Kura.Application/DTOs/Agenda/AgendaResponseDto.cs e AgendamentoItemDto.cs).
// Ficam locais a este service porque representam o contrato de rede do
// backend, não o contrato consumido pela UI (esse é o papel de `types/api.ts`).

interface AgendamentoItemApiDto {
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

interface AgendaApiResponseDto {
  dataInicio: string;
  dataFim: string;
  agendamentos: AgendamentoItemApiDto[];
}

// ─── Tabela de tradução de status de agendamento ───────────────────────────
// Valores reais possíveis de ST_STATUS (ver CHK_AGEND_STATUS em
// backend-tutor-java V1__initial_schema.sql, tabela compartilhada
// AGENDAMENTO): 'INTENCAO' | 'AGENDADO' | 'CONFIRMADO' | 'REALIZADO' |
// 'CANCELADO' | 'NAO_COMPARECEU'.
// O enum consumido pelo app (AgendamentoResponse.sgStatus) não tem
// equivalente 1:1 para todos — mapeamento por aproximação semântica:
//   INTENCAO        -> AGENDADA      (ainda não confirmado, mais próximo de "agendado")
//   AGENDADO        -> AGENDADA
//   CONFIRMADO      -> EM_ANDAMENTO  (não há status "em andamento" real no backend;
//                                     CONFIRMADO é o mais próximo de "processo em curso")
//   REALIZADO       -> CONCLUIDA
//   CANCELADO       -> CANCELADA
//   NAO_COMPARECEU  -> CANCELADA     (não há bucket próprio; tratado como não concluído)
const STATUS_TRANSLATION_TABLE: Record<string, AgendamentoResponse['sgStatus']> = {
  INTENCAO: 'AGENDADA',
  AGENDADO: 'AGENDADA',
  CONFIRMADO: 'EM_ANDAMENTO',
  REALIZADO: 'CONCLUIDA',
  CANCELADO: 'CANCELADA',
  NAO_COMPARECEU: 'CANCELADA',
};

function translateStatus(dsStatus: string): AgendamentoResponse['sgStatus'] {
  return STATUS_TRANSLATION_TABLE[dsStatus] ?? 'AGENDADA';
}

function mapAgendamentoItem(dto: AgendamentoItemApiDto): AgendamentoResponse {
  return {
    id: dto.idAgendamento,
    dtInicio: dto.dtAgendamento,
    nrDuracaoMinutos: dto.duracaoMinutos,
    sgStatus: translateStatus(dto.dsStatus),
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
