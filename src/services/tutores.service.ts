import { apiClient } from './api/client';
import type { TutorDetalheApiResponse, TutorDetalheResponse } from '../types/api';

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
