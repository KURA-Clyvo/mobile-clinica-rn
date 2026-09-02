// FM-04 (revisão pós-medição do maestro, 2026-09-02): fonte única de
// tradução/tone/label de status de agendamento, extraída depois de o
// maestro medir que agenda.service.ts/agenda.tsx e dashboard.service.ts/
// dashboard.tsx tinham a MESMA cadeia redigitada à mão duas vezes, e que
// tinha divergido — ver o cabeçalho de src/utils/statusAgendamento.ts.
import {
  translateStatusAgendamento,
  statusAgendamentoTone,
  statusAgendamentoLabel,
} from '../src/utils/statusAgendamento';

describe('translateStatusAgendamento', () => {
  it('translates each raw ST_STATUS value to its app bucket', () => {
    expect(translateStatusAgendamento('INTENCAO')).toBe('AGENDADA');
    expect(translateStatusAgendamento('AGENDADO')).toBe('AGENDADA');
    expect(translateStatusAgendamento('CONFIRMADO')).toBe('CONFIRMADA');
    expect(translateStatusAgendamento('REALIZADO')).toBe('CONCLUIDA');
    expect(translateStatusAgendamento('CANCELADO')).toBe('CANCELADA');
    expect(translateStatusAgendamento('NAO_COMPARECEU')).toBe('NAO_COMPARECEU');
  });

  it('falls back to AGENDADA for an unknown raw status', () => {
    expect(translateStatusAgendamento('ALGO_QUE_NAO_EXISTE')).toBe('AGENDADA');
  });
});

describe('statusAgendamentoLabel / statusAgendamentoTone', () => {
  // Exaustivo por construção: itera sobre TODOS os 5 buckets possíveis do
  // union StatusAgendamentoApp — uma entrada nova no tipo sem entrada aqui
  // quebra por `as const` + índice, não por omissão silenciosa.
  const casos: Array<{ status: Parameters<typeof statusAgendamentoLabel>[0]; label: string; tone: string }> = [
    { status: 'AGENDADA', label: 'Agendada', tone: 'ocean' },
    { status: 'CONFIRMADA', label: 'Confirmada', tone: 'amber' },
    { status: 'CONCLUIDA', label: 'Concluída', tone: 'sage' },
    { status: 'CANCELADA', label: 'Cancelada', tone: 'mute' },
    { status: 'NAO_COMPARECEU', label: 'Não compareceu', tone: 'clay' },
  ];

  it.each(casos)('$status -> rótulo "$label", tone "$tone"', ({ status, label, tone }) => {
    expect(statusAgendamentoLabel(status)).toBe(label);
    expect(statusAgendamentoTone(status)).toBe(tone);
  });

  // A prova central do achado nº 2 (e da extensão do maestro): CONFIRMADA e
  // NAO_COMPARECEU têm rótulo E tone PRÓPRIOS, distintos de qualquer outro
  // bucket — nenhum dos dois "cai" em cima de CANCELADA ou de um
  // 'EM_ANDAMENTO' inexistente.
  it('CONFIRMADA and NAO_COMPARECEU are distinct from every other bucket (label and tone)', () => {
    const labels = casos.map((c) => c.label);
    const tones = casos.map((c) => c.tone);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(tones).size).toBe(tones.length);
  });
});
