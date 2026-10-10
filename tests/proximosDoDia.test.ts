import {
  organizarDia,
  ordenarPorHorario,
  indiceMarcaAgora,
  minutosDeAtraso,
  minutosDeEspera,
  etapaAtiva,
} from '../src/utils/proximosDoDia';
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

describe('proximosDoDia -- classificacao por etapa e ordem', () => {
  it('so as 4 etapas ativas entram; as 3 encerradas nunca (teste com as 7 etapas)', () => {
    const sete = ['AGENDADO', 'CONFIRMADO', 'CHEGOU', 'EM_ATENDIMENTO', 'FINALIZADO', 'NAO_COMPARECEU', 'CANCELADO'];
    const lista = sete.map((e, i) => ag(i + 1, `P${i}`, 13 + (i % 5), 0, e));
    const dia = organizarDia(lista, AGORA);
    const aparecem = [...dia.emAtendimento, ...(dia.proximo ? [dia.proximo] : []), ...dia.seguintes].map(
      (a) => a.dsEtapaRecepcao,
    );
    expect(aparecem.sort()).toEqual(['AGENDADO', 'CHEGOU', 'CONFIRMADO', 'EM_ATENDIMENTO']);
    expect(dia.encerrados).toBe(3);
    expect(sete.filter(etapaAtiva)).toHaveLength(4);
  });

  it('ordena por dtInicio crescente a partir de fixture fora de ordem', () => {
    const dia = organizarDia(DIA_DO_PRINT, AGORA);
    const horarios = [dia.proximo!, ...dia.seguintes].map((a) => a.pet.nmPet);
    expect(horarios).toEqual(['Thor', 'Nala', 'Simba', 'Mel', 'Bolinha', 'Fifi']);
    expect(ordenarPorHorario(DIA_DO_PRINT)[0].pet.nmPet).toBe('Rex');
  });

  it('D1: o proximo e o primeiro ativo que NAO esta em atendimento; quem esta em atendimento vai para a faixa', () => {
    const dia = organizarDia(DIA_DO_PRINT, AGORA);
    expect(dia.emAtendimento.map((a) => a.pet.nmPet)).toEqual(['Max']);
    // Max (11:15, EM_ATENDIMENTO) e o primeiro ativo por horario, mas NAO e o proximo.
    expect(dia.proximo?.pet.nmPet).toBe('Thor');
    expect(dia.seguintes.map((a) => a.pet.nmPet)).not.toContain('Max');
    expect(dia.seguintes.map((a) => a.pet.nmPet)).not.toContain('Thor');
  });

  it('sem ativos: nem proximo nem faixa; so o numero de encerrados', () => {
    const dia = organizarDia([ag(1, 'A', 9, 0, 'FINALIZADO'), ag(2, 'B', 10, 0, 'CANCELADO')], AGORA);
    expect(dia.proximo).toBeNull();
    expect(dia.emAtendimento).toEqual([]);
    expect(dia.seguintes).toEqual([]);
    expect(dia.marcaAgora).toBeNull();
    expect(dia.encerrados).toBe(2);
  });

  it('lista vazia: tudo vazio, total 0', () => {
    const dia = organizarDia([], AGORA);
    expect(dia).toMatchObject({ proximo: null, emAtendimento: [], seguintes: [], encerrados: 0, total: 0 });
  });
});

describe('proximosDoDia -- atraso, espera e marca "agora"', () => {
  it('atrasado (AGENDADO/CONFIRMADO com horario passado) fica na lista com N min de atraso (Nala = 10)', () => {
    const dia = organizarDia(DIA_DO_PRINT, AGORA);
    const nala = dia.seguintes.find((a) => a.pet.nmPet === 'Nala')!;
    expect(minutosDeAtraso(nala, AGORA)).toBe(10);
    const simba = dia.seguintes.find((a) => a.pet.nmPet === 'Simba')!;
    expect(minutosDeAtraso(simba, AGORA)).toBeNull(); // 12:30 ainda no futuro
  });

  it('quem ja chegou ou esta em atendimento nunca tem "atraso"; menos de 1 min tambem nao', () => {
    expect(minutosDeAtraso(ag(1, 'A', 11, 0, 'CHEGOU'), AGORA)).toBeNull();
    expect(minutosDeAtraso(ag(2, 'B', 11, 0, 'EM_ATENDIMENTO'), AGORA)).toBeNull();
    expect(minutosDeAtraso(ag(3, 'C', 11, 59, 'AGENDADO'), new Date(2026, 9, 9, 11, 59, 30))).toBeNull();
  });

  it('espera so na etapa CHEGOU, a partir de dtCheckin (Thor = 8 min)', () => {
    const thor = DIA_DO_PRINT.find((a) => a.pet.nmPet === 'Thor')!;
    expect(minutosDeEspera(thor, AGORA)).toBe(8);
    expect(minutosDeEspera(ag(1, 'A', 11, 0, 'AGENDADO'), AGORA)).toBeNull();
  });

  it('marca "agora" cai depois da Nala (11:50) e antes da Simba (12:30) na fixture do print', () => {
    const dia = organizarDia(DIA_DO_PRINT, AGORA);
    // seguintes = Nala, Simba, Mel, Bolinha, Fifi -> 1 item ja passou (Nala)
    expect(dia.marcaAgora).toBe(1);
  });

  it('casos de borda: todos no passado / todos no futuro / 1 item / vazio', () => {
    const passado = [ag(1, 'A', 9, 0, 'AGENDADO'), ag(2, 'B', 10, 0, 'AGENDADO')];
    const futuro = [ag(3, 'C', 13, 0, 'AGENDADO'), ag(4, 'D', 14, 0, 'AGENDADO')];
    expect(indiceMarcaAgora(ordenarPorHorario(passado), AGORA)).toBe(2); // fim
    expect(indiceMarcaAgora(ordenarPorHorario(futuro), AGORA)).toBe(0); // inicio
    expect(indiceMarcaAgora([ag(5, 'E', 9, 0, 'AGENDADO')], AGORA)).toBe(1);
    expect(indiceMarcaAgora([ag(6, 'F', 15, 0, 'AGENDADO')], AGORA)).toBe(0);
    expect(indiceMarcaAgora([], AGORA)).toBeNull();
  });

  it('horario exatamente igual a agora conta como "ja passou" (<=)', () => {
    expect(indiceMarcaAgora([ag(1, 'A', 12, 0, 'AGENDADO')], AGORA)).toBe(1);
  });
});
