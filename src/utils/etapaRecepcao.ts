import type { ChipTone } from '@components/primitives/KCChip';

// REC-12 (KURA_BACKLOG_RECEPCAO.md) — a etapa de recepção (A-3) é DERIVADA NO
// SERVIDOR (AgendaService.CalcularEtapaRecepcao, backend-clinica-dotnet,
// `main` @ 242be7d — fix wave G2, m-2: re-ancorado, era 099ee3f/branch) e
// chega pronta em
// `AgendamentoResponse.dsEtapaRecepcao`. Este arquivo só TRADUZ o valor
// pronto para rótulo/cor — nunca recalcula a partir de status+timestamps
// (seria uma 2ª cópia da regra de precedência, a mesma classe de
// apodrecimento que A-3 cita como motivo de centralizar no servidor: "a
// tabela de transição já é cópia à mão no app — uma 2ª cópia seria a
// próxima a apodrecer").
export type EtapaRecepcao =
  | 'AGENDADO'
  | 'CONFIRMADO'
  | 'CHEGOU'
  | 'EM_ATENDIMENTO'
  | 'FINALIZADO'
  | 'NAO_COMPARECEU'
  | 'CANCELADO';

const ETAPA_LABELS: Record<EtapaRecepcao, string> = {
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Confirmado',
  CHEGOU: 'Chegou',
  EM_ATENDIMENTO: 'Em atendimento',
  FINALIZADO: 'Finalizado',
  NAO_COMPARECEU: 'Não compareceu',
  CANCELADO: 'Cancelado',
};

// Fallback (valor fora do domínio de 7) devolve o valor CRU em vez de
// lançar/mascarar — mesma postura de `getTransicoesPermitidas` (agenda.
// service.ts): "sem uma leitura fresca de servidor, a resposta segura é não
// inventar rótulo, só exibir o que veio".
export function etapaRecepcaoLabel(etapa: string): string {
  return ETAPA_LABELS[etapa as EtapaRecepcao] ?? etapa;
}

export function etapaRecepcaoTone(etapa: string): ChipTone {
  switch (etapa as EtapaRecepcao) {
    case 'AGENDADO':
      return 'ocean';
    case 'CONFIRMADO':
      return 'amber';
    case 'CHEGOU':
    case 'EM_ATENDIMENTO':
      return 'sage';
    case 'NAO_COMPARECEU':
      return 'clay';
    case 'FINALIZADO':
    case 'CANCELADO':
      return 'mute';
    default:
      return 'mute';
  }
}

// Botões "Chegou"/"Faltou" (REC-12) — gate de VISIBILIDADE no app, nunca
// autoridade: o servidor decide de verdade (422 se a chamada não for
// permitida — REC-11, AgendaService.StatusElegiveisParaEventoRecepcao só
// aceita a partir de AGENDADO/CONFIRMADO). Mostrar o botão fora dessas
// regras só produziria um 422 evitável; o app usa a MESMA etapa que o
// servidor já calculou (dsEtapaRecepcao), nunca recalcula a condição.
export function podeRegistrarChegada(etapa: string): boolean {
  return etapa === 'AGENDADO' || etapa === 'CONFIRMADO';
}

// Falta (REC-11, guarda em AtualizarStatusAsync): só a partir de
// AGENDADO/CONFIRMADO (mesma condição do check-in, porque check-in/início
// já movem a etapa para CHEGOU/EM_ATENDIMENTO — a guarda do servidor
// rejeita falta depois de qualquer um dos dois) E só a partir do horário
// marcado. `agora` é o relógio do DISPOSITIVO — aproximação de UI; o
// servidor usa IRelogioClinica (hora local de SP, A-5), a fonte real. Se a
// aproximação errar por alguns segundos perto do limite, o pior caso é um
// 422 do servidor, tratado como aviso (nunca dado como certo no cliente).
export function podeMarcarFalta(
  etapa: string,
  dtAgendamento: string,
  agora: Date = new Date(),
): boolean {
  return podeRegistrarChegada(etapa) && agora.getTime() >= new Date(dtAgendamento).getTime();
}

// A-6: "nenhum KPI agregado — tempo de espera aparece POR LINHA, calculado
// NA TELA a partir de DT_CHECKIN". A origem do cálculo TEM que ser
// `dtCheckin` (hora local de SP gravada pelo servidor via IRelogioClinica,
// REC-08/A-5/REC-11) — nunca outro relógio (ex.: o instante em que a tela
// montou), que divergiria a cada refresh/remontagem e não representaria
// "há quanto tempo o paciente chegou".
export function minutosEsperando(dtCheckin: string, agora: Date = new Date()): number {
  const checkin = new Date(dtCheckin);
  const diffMs = agora.getTime() - checkin.getTime();
  return Math.max(0, Math.round(diffMs / 60000));
}

export type OrigemAgendamento = 'PORTAL' | 'RECEPCAO' | 'TRIAGEM_LUNA';

export function origemLabel(origem: string | null | undefined): string {
  switch (origem as OrigemAgendamento) {
    case 'PORTAL':
      return 'App do tutor';
    case 'RECEPCAO':
      return 'Recepção';
    case 'TRIAGEM_LUNA':
      return 'Triagem da Luna';
    default:
      return origem ?? 'Recepção';
  }
}

// Selo de origem TRIAGEM_LUNA usa a cor da URGÊNCIA (BAIXA/MEDIA/ALTA) da
// triagem que originou o agendamento — mesmos tokens de tone de `luna.tsx`
// (filaUrgenciaTone: ALTA->clay, MEDIA->amber, BAIXA->mute), não hex
// inventado. PORTAL/RECEPCAO usam 'mute' (neutro — não são triagem, não têm
// nível de urgência).
export function origemTone(
  origem: string | null | undefined,
  nivelUrgencia: string | null | undefined,
): ChipTone {
  if (origem === 'TRIAGEM_LUNA') {
    switch (nivelUrgencia) {
      case 'ALTA':
        return 'clay';
      case 'MEDIA':
        return 'amber';
      case 'BAIXA':
        return 'mute';
      default:
        return 'mute';
    }
  }
  return 'mute';
}
