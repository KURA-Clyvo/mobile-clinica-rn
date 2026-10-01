import type { ChipTone } from '@components/primitives/KCChip';

// REC-17 (KURA_BACKLOG_RECEPCAO.md) — selo "resposta do tutor ao lembrete D-1".
//
// ÂNCORA DO CONTRATO (regra 11 do CLAUDE.md do workspace). O valor chega em
// `AgendamentoItemDto.DsRespostaConfirmacao` (backend-clinica-dotnet
// `src/Kura.Application/DTOs/Agenda/AgendaResponseDto.cs:34`, preenchido em
// `AgendaService.cs:514`) e é gravado por `LunaService.cs:505-532` na
// `main` @ `81d5a58` (conferido em 2026-10-01 com
// `git show main:src/Kura.Application/Services/LunaService.cs | sed -n 495,550p`):
//   - `SIM`      => ST_STATUS vira CONFIRMADO            (:506-512)
//   - `CANCELAR` => ST_STATUS vira CANCELADO             (:514-517)
//   - `REMARCAR` => NÃO muda ST_STATUS, só grava a resposta (:519-523, A-10 b)
// O domínio é fechado em `RespostaConfirmacaoRequestValidator.cs:23`
// (`SIM|CANCELAR|REMARCAR`).
//
// Este arquivo só TRADUZ o valor pronto em selo — nunca deriva a resposta de
// status (REMARCAR deixa o status em AGENDADO/CONFIRMADO, então status não
// serve de proxy). `CANCELAR` NÃO tem selo: o status já aparece como
// "Cancelado" na linha, e o backlog só pede os selos de SIM e REMARCAR.
export interface SeloRespostaTutor {
  label: string;
  tone: ChipTone;
  /** true => a linha oferece a ação "Remarcar" (abre o formulário da REC-14). */
  oferecerRemarcar: boolean;
}

export function seloRespostaTutor(
  dsRespostaConfirmacao: string | null | undefined,
): SeloRespostaTutor | null {
  switch (dsRespostaConfirmacao) {
    case 'SIM':
      return { label: 'Confirmou pelo WhatsApp', tone: 'sage', oferecerRemarcar: false };
    case 'REMARCAR':
      return { label: 'Pediu para remarcar', tone: 'amber', oferecerRemarcar: true };
    default:
      // null/undefined, 'CANCELAR' (sem selo, ver acima) e qualquer valor
      // fora do domínio de 3: sem selo e sem lançar.
      return null;
  }
}

// REMARCAR não muda o status no servidor, e check-in/início de atendimento TAMBÉM
// não (AgendaService.cs:140-145 @ 81d5a58: "Check-in e início NÃO transicionam
// ST_STATUS (A-2) ... é DsEtapaRecepcao quem muda"). Então a ação NÃO pode decidir por
// `dsStatusOrigem`: um pet que já chegou ou está em atendimento continua AGENDADO/
// CONFIRMADO ali. A etapa (derivada no servidor, A-3) é a fonte; só enquanto ela for
// AGENDADO ou CONFIRMADO a consulta ainda está de pé para ser remarcada. Fora disso
// (CHEGOU, EM_ATENDIMENTO, FINALIZADO, NAO_COMPARECEU, CANCELADO) o selo fica e a ação some.
const ETAPAS_REMARCAVEIS = ['AGENDADO', 'CONFIRMADO'];

export function podeOferecerRemarcar(
  dsRespostaConfirmacao: string | null | undefined,
  dsEtapaRecepcao: string,
): boolean {
  return (
    seloRespostaTutor(dsRespostaConfirmacao)?.oferecerRemarcar === true &&
    ETAPAS_REMARCAVEIS.includes(dsEtapaRecepcao)
  );
}
