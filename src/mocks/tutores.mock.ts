import type { InternalAxiosRequestConfig } from 'axios';
import type { TutorDetalheApiResponse } from '../types/api';

// LU-09: shape de FIO (TutorDetalheApiResponse — TutorResponseDto real) para a ação
// "Responder no WhatsApp" da Fila da Luna. `id` extraído da URL para casar com o
// `tutor.id` que luna.mock.ts::triagens() devolve no item ALTA (201) — um id fora
// dessa faixa ainda devolve um tutor plausível (fallback), nunca lança.
export async function byId(config: InternalAxiosRequestConfig): Promise<TutorDetalheApiResponse> {
  const match = /\/tutores\/(\d+)$/.exec(config.url ?? '');
  const id = match ? Number(match[1]) : 0;
  if (id === 201) {
    return {
      id: 201,
      nmTutor: 'Ana Beatriz',
      nrCpf: '12345678900',
      dsEmail: 'ana.beatriz@example.com',
      nrTelefone: '11988887777',
      stAtiva: true,
    };
  }
  return {
    id,
    nmTutor: 'Tutor Mock',
    nrCpf: '00000000000',
    dsEmail: 'tutor.mock@example.com',
    nrTelefone: '11999990000',
    stAtiva: true,
  };
}
