import {
  etapaRecepcaoLabel,
  etapaRecepcaoTone,
  podeRegistrarChegada,
  podeMarcarFalta,
  minutosEsperando,
  origemLabel,
  origemTone,
} from '../src/utils/etapaRecepcao';

describe('etapaRecepcaoLabel/etapaRecepcaoTone (REC-12, A-3)', () => {
  it.each([
    ['AGENDADO', 'Agendado', 'ocean'],
    ['CONFIRMADO', 'Confirmado', 'amber'],
    ['CHEGOU', 'Chegou', 'sage'],
    ['EM_ATENDIMENTO', 'Em atendimento', 'sage'],
    ['FINALIZADO', 'Finalizado', 'mute'],
    ['NAO_COMPARECEU', 'Não compareceu', 'clay'],
    ['CANCELADO', 'Cancelado', 'mute'],
  ])('%s -> label %s, tone %s', (etapa, label, tone) => {
    expect(etapaRecepcaoLabel(etapa)).toBe(label);
    expect(etapaRecepcaoTone(etapa)).toBe(tone);
  });

  it('valor fora do domínio de 7 é exibido cru, não mascarado', () => {
    expect(etapaRecepcaoLabel('XPTO')).toBe('XPTO');
    expect(etapaRecepcaoTone('XPTO')).toBe('mute');
  });
});

describe('podeRegistrarChegada / podeMarcarFalta (REC-12, gate de visibilidade)', () => {
  it('Chegou só aparece em AGENDADO/CONFIRMADO', () => {
    expect(podeRegistrarChegada('AGENDADO')).toBe(true);
    expect(podeRegistrarChegada('CONFIRMADO')).toBe(true);
    expect(podeRegistrarChegada('CHEGOU')).toBe(false);
    expect(podeRegistrarChegada('EM_ATENDIMENTO')).toBe(false);
    expect(podeRegistrarChegada('FINALIZADO')).toBe(false);
    expect(podeRegistrarChegada('CANCELADO')).toBe(false);
    expect(podeRegistrarChegada('NAO_COMPARECEU')).toBe(false);
  });

  it('Faltou só aparece em AGENDADO/CONFIRMADO E no horário marcado ou depois', () => {
    const agora = new Date('2026-09-28T10:00:00');
    const antes = '2026-09-28T10:30:00'; // ainda não chegou a hora
    const noHorario = '2026-09-28T10:00:00';
    const depois = '2026-09-28T09:30:00';

    expect(podeMarcarFalta('AGENDADO', antes, agora)).toBe(false);
    expect(podeMarcarFalta('AGENDADO', noHorario, agora)).toBe(true);
    expect(podeMarcarFalta('AGENDADO', depois, agora)).toBe(true);
  });

  it('Faltou NUNCA aparece fora de AGENDADO/CONFIRMADO, mesmo com horário já passado', () => {
    const agora = new Date('2026-09-28T10:00:00');
    const jaPassou = '2026-09-28T09:00:00';
    expect(podeMarcarFalta('CHEGOU', jaPassou, agora)).toBe(false);
    expect(podeMarcarFalta('EM_ATENDIMENTO', jaPassou, agora)).toBe(false);
    expect(podeMarcarFalta('FINALIZADO', jaPassou, agora)).toBe(false);
    expect(podeMarcarFalta('CANCELADO', jaPassou, agora)).toBe(false);
    expect(podeMarcarFalta('NAO_COMPARECEU', jaPassou, agora)).toBe(false);
  });
});

// A-6: "tempo de espera aparece POR LINHA, calculado NA TELA a partir de
// DT_CHECKIN" — a origem do cálculo TEM que ser dtCheckin, nunca outro
// relógio. Prova de mordida real está no relatório final (mutação em
// minutosEsperando, restaurada) — aqui a suíte cobre o comportamento CERTO
// com precisão suficiente para que a mordida (trocar `checkin` pelo
// parâmetro `agora` no cálculo) derrube este teste.
describe('minutosEsperando (A-6)', () => {
  it('calcula a diferença entre "agora" e dtCheckin, arredondado', () => {
    const checkin = '2026-09-28T09:00:00';
    const agora = new Date('2026-09-28T09:12:30');
    expect(minutosEsperando(checkin, agora)).toBe(13); // 12.5min arredonda pra 13
  });

  it('nunca devolve negativo (checkin no "futuro" por deriva de relógio)', () => {
    const checkin = '2026-09-28T09:30:00';
    const agora = new Date('2026-09-28T09:00:00');
    expect(minutosEsperando(checkin, agora)).toBe(0);
  });

  it('dois checkins DIFERENTES no MESMO "agora" produzem minutos DIFERENTES — prova que a origem é dtCheckin, não um relógio fixo', () => {
    const agora = new Date('2026-09-28T10:00:00');
    const cedo = minutosEsperando('2026-09-28T09:00:00', agora);
    const tarde = minutosEsperando('2026-09-28T09:50:00', agora);
    expect(cedo).toBe(60);
    expect(tarde).toBe(10);
    expect(cedo).not.toBe(tarde);
  });
});

describe('origemLabel / origemTone (A-1, selo de origem)', () => {
  it.each([
    ['PORTAL', 'App do tutor'],
    ['RECEPCAO', 'Recepção'],
    ['TRIAGEM_LUNA', 'Triagem da Luna'],
  ])('%s -> %s', (origem, label) => {
    expect(origemLabel(origem)).toBe(label);
  });

  it('PORTAL/RECEPCAO usam tone mute (sem urgência)', () => {
    expect(origemTone('PORTAL', null)).toBe('mute');
    expect(origemTone('RECEPCAO', null)).toBe('mute');
  });

  it.each([
    ['ALTA', 'clay'],
    ['MEDIA', 'amber'],
    ['BAIXA', 'mute'],
  ])('TRIAGEM_LUNA com urgência %s usa tone %s (mesmos tokens de luna.tsx)', (nivel, tone) => {
    expect(origemTone('TRIAGEM_LUNA', nivel)).toBe(tone);
  });
});
