import type { ChipTone } from '@components/primitives/KCChip';

// FM-04 — fonte ÚNICA da tradução de status de agendamento. Extraída depois
// de o maestro medir que a MESMA cadeia (tipo -> tradução -> tone -> label)
// estava escrita à mão em DOIS lugares — agenda.service.ts/agenda.tsx (que
// esta task corrigiu) e dashboard.service.ts/dashboard.tsx (que ficou de
// fora do escopo original e continuava com CONFIRMADO->'EM_ANDAMENTO' e
// NAO_COMPARECEU->'CANCELADA', o mesmo achado nº 2 que motivou a correção
// da agenda). Duas telas mostrando o MESMO agendamento com rótulos
// diferentes ("Confirmada" na agenda, "Em andamento" no dashboard) é o
// mesmo defeito do achado nº 2, só que ENTRE telas em vez de dentro de uma.
//
// Daqui pra frente, acrescentar um status novo é UMA edição, não duas — e um
// tipo divergente entre agenda/dashboard vira erro de `tsc`, não silêncio,
// porque os dois `sgStatus` (AgendamentoResponse e RecentAppointmentResponse,
// em types/api.ts) e o `Agendamento.status` (types/domain.ts) referenciam
// este MESMO alias, em vez de redigitar o union.

// Valores reais possíveis de ST_STATUS (ver CHK_AGEND_STATUS em
// backend-tutor-java V1__initial_schema.sql, tabela compartilhada
// AGENDAMENTO): 'INTENCAO' | 'AGENDADO' | 'CONFIRMADO' | 'REALIZADO' |
// 'CANCELADO' | 'NAO_COMPARECEU'.
export type StatusAgendamentoApp =
  | 'AGENDADA'
  | 'CONFIRMADA'
  | 'CONCLUIDA'
  | 'CANCELADA'
  | 'NAO_COMPARECEU';

// O enum consumido pelo app não tem equivalente 1:1 para todos — mapeamento
// por aproximação semântica:
//   INTENCAO        -> AGENDADA       (ainda não confirmado, mais próximo de "agendado")
//   AGENDADO        -> AGENDADA
//   CONFIRMADO      -> CONFIRMADA     (bucket próprio)
//   REALIZADO       -> CONCLUIDA
//   CANCELADO       -> CANCELADA
//   NAO_COMPARECEU  -> NAO_COMPARECEU (bucket próprio — distinto de CANCELADA)
const STATUS_TRANSLATION_TABLE: Record<string, StatusAgendamentoApp> = {
  INTENCAO: 'AGENDADA',
  AGENDADO: 'AGENDADA',
  CONFIRMADO: 'CONFIRMADA',
  REALIZADO: 'CONCLUIDA',
  CANCELADO: 'CANCELADA',
  NAO_COMPARECEU: 'NAO_COMPARECEU',
};

export function translateStatusAgendamento(dsStatus: string): StatusAgendamentoApp {
  return STATUS_TRANSLATION_TABLE[dsStatus] ?? 'AGENDADA';
}

export function statusAgendamentoTone(sgStatus: StatusAgendamentoApp): ChipTone {
  switch (sgStatus) {
    case 'AGENDADA':       return 'ocean';
    case 'CONFIRMADA':     return 'amber';
    case 'CONCLUIDA':      return 'sage';
    case 'CANCELADA':      return 'mute';
    // 'clay' é o único tone que sobra em KCChip (sage/amber/ocean/mute já
    // usados acima) — reforça que é um estado de atenção, diferente de
    // cancelamento (mute).
    case 'NAO_COMPARECEU': return 'clay';
  }
}

export function statusAgendamentoLabel(sgStatus: StatusAgendamentoApp): string {
  switch (sgStatus) {
    case 'AGENDADA':       return 'Agendada';
    case 'CONFIRMADA':     return 'Confirmada';
    case 'CONCLUIDA':      return 'Concluída';
    case 'CANCELADA':      return 'Cancelada';
    case 'NAO_COMPARECEU': return 'Não compareceu';
  }
}
