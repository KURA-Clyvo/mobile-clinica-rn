import { apiClient } from './api/client';
import type { TutorDetalheApiResponse, TutorDetalheResponse } from '../types/api';

// LU-09 fix wave 1 (item 2, lu-09-revisao.md G2-3): sentinela que o .NET grava em
// `NR_TELEFONE` quando o cadastro do tutor não tem telefone (TutorService.cs:97-99,
// TASK-60, coalesce de NOT NULL do Oracle) — confirmado literalmente na fonte:
// `grep -rn "Não informado" src` em backend-clinica-dotnet, 2 ocorrências. Um
// telefone igual a este literal (ou vazio) não é um número real e nunca deve ser
// oferecido como destino de WhatsApp — mandar `para: "Não informado"` para a Luna
// resulta em falha de envio (502, Twilio rejeita o destinatário).
export const TELEFONE_SENTINELA = 'Não informado';

export function telefoneDisponivel(telefone: string | null | undefined): boolean {
  return !!telefone && telefone.trim().length > 0 && telefone !== TELEFONE_SENTINELA;
}

/**
 * LU-09: busca o tutor pelo ID para a ação "Responder no WhatsApp" da Fila da Luna.
 * GET /api/v1/tutores/{id} (TutoresController.cs:44) — JWT de clínica, escopado por
 * IClinicaContext no service (.NET), NUNCA vaza tutor de outra clínica. Só 3 campos do
 * TutorResponseDto real (Id/NmTutor/NrTelefone) entram no tipo interno — o resto
 * (NrCpf/DsEmail/StAtiva) não é necessário para este fluxo.
 */
export async function getTutorById(id: number): Promise<TutorDetalheResponse> {
  const { data } = await apiClient.get<TutorDetalheApiResponse>(`/api/v1/tutores/${id}`);
  return {
    id: data.id,
    nmTutor: data.nmTutor,
    nrTelefone: data.nrTelefone,
  };
}
