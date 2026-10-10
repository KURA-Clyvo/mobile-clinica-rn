import type { AgendamentoResponse } from '../src/types/api';

// BR-CLI-T06 -- fixture do print-alvo: 09/10/2026, agora = 12:00 (hora local do teste).
export const AGORA = new Date(2026, 9, 9, 12, 0, 0);
const hhmm = (h: number, m: number) => new Date(2026, 9, 9, h, m, 0);
const naive = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00`;
};

export function ag(
  id: number,
  pet: string,
  h: number,
  m: number,
  etapa: string,
  extra: Partial<AgendamentoResponse> = {},
): AgendamentoResponse {
  return {
    id,
    dtInicio: naive(hhmm(h, m)),
    nrDuracaoMinutos: 30,
    sgStatus: 'AGENDADA',
    dsStatusOrigem: 'AGENDADO',
    nrVersion: 1,
    pet: { id: 100 + id, nmPet: pet, nmEspecie: '', nmRaca: '' },
    tutor: { id: 200 + id, nmTutor: `Tutor de ${pet}`, dsTelefone: '' },
    veterinario: { id: 1, nmVeterinario: 'Dra. Ana', nrCRMV: '' },
    
    dsEtapaRecepcao: etapa,
    ...extra,
  } as AgendamentoResponse;
}

// Fora de ordem de proposito (o servidor nao garante ordenacao).
export const DIA_DO_PRINT: AgendamentoResponse[] = [
  ag(5, 'Mel', 13, 15, 'AGENDADO'),
  ag(2, 'Thor', 11, 45, 'CHEGOU', { dtCheckin: naive(hhmm(11, 52)) }),
  ag(1, 'Max', 11, 15, 'EM_ATENDIMENTO', { dtInicioAtendimento: naive(hhmm(11, 22)) }),
  ag(4, 'Simba', 12, 30, 'CONFIRMADO'),
  ag(3, 'Nala', 11, 50, 'AGENDADO'),
  ag(6, 'Bolinha', 14, 0, 'AGENDADO'),
  ag(7, 'Fifi', 15, 30, 'AGENDADO'),
  ag(8, 'Rex', 8, 0, 'FINALIZADO'),
  ag(9, 'Luna', 9, 0, 'CANCELADO'),
  ag(10, 'Bidu', 10, 0, 'NAO_COMPARECEU'),
];

