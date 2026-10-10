import {
  organizarDia,
  ordenarPorHorario,
  indiceMarcaAgora,
  minutosDeAtraso,
  minutosDeEspera,
  etapaAtiva,
} from '../src/utils/proximosDoDia';
import { AGORA, DIA_DO_PRINT, ag } from './helpers_proximos';

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
    expect(ordenarPorHorario(DIA_DO_PRINT)[0]!.pet.nmPet).toBe('Rex');
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

describe('proximosDoDia -- regra B-17 do destaque (G2 da BR-CLI-T06, I-3)', () => {
  // Fixture da G2: 12:00, Rex AGENDADO 09:00 que nunca veio (sem check-in) + Nina que Chegou.
  const FIXTURE_G2 = [
    ag(1, 'Rex', 9, 0, 'AGENDADO'),
    ag(2, 'Nina', 10, 0, 'CHEGOU', { dtCheckin: '2026-10-09T09:55:00' }),
    ag(3, 'Zeca', 13, 0, 'AGENDADO'),
    ag(4, 'Bia', 14, 0, 'CONFIRMADO'),
  ];

  it('atrasado sem check-in antes de um "Chegou": o destaque e quem esta esperando (Nina), nao o Rex', () => {
    const dia = organizarDia(FIXTURE_G2, AGORA);
    expect(dia.proximo?.pet.nmPet).toBe('Nina');
    expect(minutosDeEspera(dia.proximo!, AGORA)).toBe(125);
    // Rex fica na lista, acima da marca "agora", com os minutos de atraso (D2)
    expect(dia.seguintes.map((a) => a.pet.nmPet)).toEqual(['Rex', 'Zeca', 'Bia']);
    expect(minutosDeAtraso(dia.seguintes[0]!, AGORA)).toBe(180);
    expect(dia.marcaAgora).toBe(1);
  });

  it('entre varios que Chegaram, o destaque e o de check-in mais antigo (nao o de horario mais cedo)', () => {
    const dia = organizarDia(
      [
        ag(1, 'Cedo', 10, 0, 'CHEGOU', { dtCheckin: '2026-10-09T11:40:00' }),
        ag(2, 'Tarde', 11, 0, 'CHEGOU', { dtCheckin: '2026-10-09T10:50:00' }),
      ],
      AGORA,
    );
    expect(dia.proximo?.pet.nmPet).toBe('Tarde');
  });

  it('ninguem espera: o destaque e o primeiro horario futuro; atrasados nunca (>= agora vale)', () => {
    const dia = organizarDia(
      [ag(1, 'Atrasado', 9, 0, 'AGENDADO'), ag(2, 'Agora', 12, 0, 'CONFIRMADO'), ag(3, 'Depois', 13, 0, 'AGENDADO')],
      AGORA,
    );
    expect(dia.proximo?.pet.nmPet).toBe('Agora');
    expect(dia.seguintes.map((a) => a.pet.nmPet)).toEqual(['Atrasado', 'Depois']);
  });

  it('so atrasados sem check-in: sem destaque, todos na lista com atraso', () => {
    const dia = organizarDia([ag(1, 'A', 9, 0, 'AGENDADO'), ag(2, 'B', 10, 0, 'CONFIRMADO')], AGORA);
    expect(dia.proximo).toBeNull();
    expect(dia.seguintes.map((a) => a.pet.nmPet)).toEqual(['A', 'B']);
    expect(dia.marcaAgora).toBe(2);
  });
});
