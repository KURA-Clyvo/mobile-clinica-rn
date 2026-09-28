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
//
// 🔴 PIN DE CONTRATO CROSS-REPO — leia antes de editar os campos REC-09/REC-11.
//
// FONTE:   backend-clinica-dotnet
//          src/Kura.Application/DTOs/Agenda/AgendaResponseDto.cs:10-41
//          (classe `AgendamentoItemDto`)
// COMMIT:  242be7d509f6… (`main`)
// CONFERIDO EM: 2026-09-28 — bate linha a linha com a fonte nesse commit (G2,
// `g2-rec12.md` F1: `git diff 099ee3f origin/main --stat -- AgendaResponseDto.cs`
// devolveu vazio — o código citado pelo pin de `099ee3f` já estava idêntico em
// `main`; só a nota "ainda não em main" ficou desatualizada, corrigida aqui).
//
// COMO RECONFERIR:
//   git -C ../backend-clinica-dotnet show \
//     242be7d:src/Kura.Application/DTOs/Agenda/AgendaResponseDto.cs | sed -n '10,41p'
//
// Serialização em camelCase (System.Text.Json default do ASP.NET Core, sem
// `JsonNamingPolicy` custom — confirmado por grep no `Program.cs`, mesma
// checagem que o relatório da REC-09 já fez).
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

  // REC-09 (fecha o E21) — todos opcionais no wire, `long?`/`string?`/
  // `DateTime?` no lado .NET. `dsEtapaRecepcao` é a única SEMPRE preenchida
  // (função total no servidor, A-3) — ver AgendamentoResponse.dsEtapaRecepcao
  // (types/api.ts) para por que ela não é opcional no tipo app-facing.
  //
  // Fix wave G2 (m-1): `System.Text.Json` serializa estes campos como `null`
  // literal quando ausentes (sem `DefaultIgnoreCondition` no `Program.cs`),
  // nunca omite a chave — `?: T` só cobre `undefined`, então o tipo mentia
  // sobre o que chega de verdade. `?: T | null` cobre os dois: `undefined`
  // (conveniência de fixture de teste, que nunca chega pela rede real) E
  // `null` (o que a rede REALMENTE manda). Todo consumidor já tratava os
  // dois igual (`dto.idPet ?? 0`, `a.dtCheckin ? …`) — mudança só de tipo,
  // sem mudança de comportamento (G2 confirmou "hoje inofensivo").
  idPet?: number | null;
  idTutor?: number | null;
  dtCheckin?: string | null;
  dtInicioAtendimento?: string | null;
  dsOrigem?: string | null;
  dsNivelUrgenciaOrigem?: string | null;
  dsRespostaConfirmacao?: string | null;
  dsEtapaRecepcao: string;
  dsFotoThumbUrl?: string | null;
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
//
// 🔴 PIN DE CONTRATO CROSS-REPO — leia antes de editar esta tabela.
//
// FONTE:   backend-clinica-dotnet
//          src/Kura.Application/Services/AgendaService.cs:90-99
//          (`TransicoesPermitidas`. Do lado de lá os estados terminais são
//          DERIVADOS desse mapa em :115-119, não mantidos à mão.)
// COMMIT:  de96c70e9f825eaf6e69f8c2a2f06669373fe29c  (`main`, 2026-09-01)
// CONFERIDO EM: 2026-09-02 — bate linha a linha com a fonte nesse commit.
//
// COMO RECONFERIR — um pin só vale se alguém conseguir verificá-lo:
//   git -C ../backend-clinica-dotnet show \
//     de96c70:src/Kura.Application/Services/AgendaService.cs | sed -n '90,99p'
//
// Deliberadamente REESCRITA aqui, não importada: os dois repos não compartilham
// código e não há como derivar entre eles. Ou seja, isto é uma CÓPIA À MÃO, e
// cai sob a regra de ouro v7 deste projeto — *inventário escrito à mão apodrece
// em silêncio*. O pin acima é a única defesa que existe: sem arquivo:linha e
// commit, "espelha o backend" é uma afirmação que ninguém consegue conferir, e
// cópia que ninguém confere é cópia que já divergiu — só não se sabe quando.
//
// RAIO DE FALHA, se divergir assim mesmo — e os dois lados NÃO são simétricos:
//   • backend REMOVE uma transição → o app oferece, o servidor recusa com 422.
//     Falha VISÍVEL, não corrupção silenciosa.
//   • backend ACRESCENTA uma transição → a ação simplesmente não aparece no
//     menu, sem erro nenhum. 🔴 É o mais difícil de notar dos dois, e é o que
//     este comentário existe para tornar improvável.
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
      // REC-12: idPet chegou no DTO pela REC-09 — fecha o TODO antigo
      // (o app tinha id=0 fixo pra todo pet da agenda até aqui).
      id: dto.idPet ?? 0,
      nmPet: dto.nmPet,
      // TODO: AgendamentoItemDto não traz espécie do pet.
      nmEspecie: '',
      // TODO: AgendamentoItemDto não traz raça do pet.
      nmRaca: '',
    },
    tutor: {
      // REC-12: idTutor chegou no DTO pela REC-09 — mesmo fechamento do
      // TODO de idPet acima.
      id: dto.idTutor ?? 0,
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

    // REC-09/REC-12 — campos da tela "Hoje" da recepção (A-3, A-6, A-7).
    // Fix wave G2 (m-1): o wire DTO agora é `T | null` (o que a rede
    // REALMENTE manda — ver comentário no tipo acima); `AgendamentoResponse`
    // (tipo app-facing, types/api.ts) continua só `T | undefined` de
    // propósito — o mapper é a camada anticorrupção certa pra colapsar
    // `null` em `undefined`, não espalhar `| null` pro app inteiro.
    dtCheckin: dto.dtCheckin ?? undefined,
    dtInicioAtendimento: dto.dtInicioAtendimento ?? undefined,
    dsOrigem: dto.dsOrigem ?? undefined,
    dsNivelUrgenciaOrigem: dto.dsNivelUrgenciaOrigem ?? undefined,
    dsRespostaConfirmacao: dto.dsRespostaConfirmacao ?? undefined,
    dsEtapaRecepcao: dto.dsEtapaRecepcao,
    dsFotoThumbUrl: dto.dsFotoThumbUrl ?? undefined,
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

// REC-12 — check-in (tela "Hoje" da recepção). Rota ABSOLUTA, mesmo padrão
// de atualizarStatusAgendamento acima. FONTE: backend-clinica-dotnet
// src/Kura.Api/Controllers/AgendaController.cs:97-106 (`[HttpPost("~/api/
// v1/agendamentos/{id:long}/checkin")]`), commit 242be7d509f6… (`main`,
// conferido em 2026-09-28 — fix wave G2, m-2: era `099ee3f`/"branch, ainda
// não em main", hoje é falso, o mesmo conteúdo está em `main`) — reconferir
// com `git -C ../backend-clinica-dotnet show 242be7d:src/Kura.Api/
// Controllers/AgendaController.cs | sed -n '97,106p'`.
//
// 🔴 m-7 (g2-rec09.md): a resposta deste endpoint (como a do PATCH de
// status) NÃO tem foto/urgência — `AtualizarStatusAsync`/`CheckinAsync`
// devolvem o DTO via `GetByIdAsync` sem `.Include(TriagemOrigem)`. Quem
// consome esta função NUNCA deve tratar o retorno como a linha completa —
// invalide a query e deixe o refetch trazer a linha de verdade (mesmo
// tratamento dado a `atualizarStatusAgendamento` — ver useAgenda.ts).
export interface CheckinAgendamentoRequest {
  nrVersion: number;
}

export async function checkinAgendamento(
  idAgendamento: number,
  req: CheckinAgendamentoRequest,
): Promise<AgendamentoResponse> {
  const response = await apiClient.post<AgendamentoItemApiDto>(
    `/api/v1/agendamentos/${idAgendamento}/checkin`,
    req,
  );
  return mapAgendamentoItem(response.data);
}
