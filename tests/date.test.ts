import { firstName, HONORIFICOS, calcularIntervaloPeriodo } from '../src/utils/date';

// ─── E26 — "Boa noite, Dr." na primeira tela pós-login ─────────────────────
//
// `FIXES_PENDENTES.md:112,848-884`, marcado PRONTO, ruling **D-3** do Felipe:
// a saudação lê "Boa noite, Felipe". O honorífico é descartado.
//
// 🔴 Este arquivo não existia antes da FM-01, e `firstName` não tinha UM
// teste — `grep -rn "firstName" tests/` devolvia ZERO com 718 testes verdes.
// Pior: `DashboardScreen.test.tsx` tinha um teste que AFIRMAVA `/Dr\./` na
// saudação, ou seja, trancava o defeito (substituído nesta mesma task).
//
// ⚠️ A armadilha que o próprio E26 nomeia, e que este arquivo evita de
// propósito: um teste ingênuo afirmaria `firstName('Dr. Felipe Ferrete') ===
// 'Dr.'` — que é **o que a função fazia**, não o que a tela precisa. Testar a
// implementação em vez do requisito foi como o defeito sobreviveu.
describe('firstName — E26', () => {
  // 🔴 DERIVADO da lista do código (`HONORIFICOS`), não redigitado aqui.
  // Regra de ouro v7: acrescentar um honorífico em date.ts passa a gerar o
  // caso de teste sozinho. Uma lista copiada para cá passaria verde sobre um
  // valor que a função não trata — que é exatamente a classe de defeito que
  // este projeto persegue.
  it.each(HONORIFICOS)('descarta o honorífico %s e devolve o primeiro nome', (honorifico) => {
    expect(firstName(`${honorifico} Felipe Ferrete`)).toBe('Felipe');
  });

  it('é insensível a caixa no honorífico', () => {
    expect(firstName('DR. Felipe Ferrete')).toBe('Felipe');
    expect(firstName('Dra. Ana Souza')).toBe('Ana');
  });

  it('nome sem título devolve o primeiro nome', () => {
    expect(firstName('Felipe Ferrete')).toBe('Felipe');
  });

  it('um único token devolve ele mesmo', () => {
    expect(firstName('Felipe')).toBe('Felipe');
  });

  // ⚠️ Caso de borda que decide o comportamento, não trivialidade: um nome
  // que é SÓ o honorífico não tem próximo token para devolver. Devolver ''
  // deixaria a saudação truncada; devolver o honorífico é o menos errado —
  // e a implementação faz isso por causa do `&& tokens.length > 1`.
  it('honorífico sozinho devolve o próprio honorífico, não vazio', () => {
    expect(firstName('Dr.')).toBe('Dr.');
  });

  it('string vazia devolve vazio, sem lançar', () => {
    expect(firstName('')).toBe('');
    expect(firstName('   ')).toBe('');
  });

  it('espaços múltiplos entre tokens não viram token vazio', () => {
    expect(firstName('Dr.    Felipe   Ferrete')).toBe('Felipe');
  });

  // Controle positivo do conjunto: um prefixo que NÃO está na lista tem que
  // ser tratado como nome. Sem isto, um `firstName` que descartasse o
  // primeiro token sempre passaria em todos os casos acima.
  it('CONTROLE POSITIVO — prefixo que não é honorífico NÃO é descartado', () => {
    expect(firstName('Prof. Felipe Ferrete')).toBe('Prof.');
    expect(firstName('Ana Paula Rodrigues')).toBe('Ana');
  });
});

// ─── calcularIntervaloPeriodo — LU-09 fix wave 1 (G2-2) ────────────────────
//
// lu-09-revisao.md, achado G2-2: o chip "90 dias" da Fila/Relatório da Luna
// mandava um intervalo de 91 dias (dataFim=hoje+1 combinado com
// dataInicio=hoje-90) e o .NET recusa com 422 quando o intervalo excede 90
// dias (LunaService.cs:166). Critério de aceite literal do brief: para CADA
// chip (7/30/90), dias(dataFim - dataInicio) <= 90 E hoje ∈ [dataInicio, dataFim).
describe('calcularIntervaloPeriodo — LU-09 fix wave 1 (G2-2)', () => {
  const HOJE = new Date(2026, 8, 15); // 15/09/2026, meio-dia não importa (yyyy-MM-dd)

  function diffDias(dataInicioISO: string, dataFimISO: string): number {
    const a = new Date(`${dataInicioISO}T00:00:00`);
    const b = new Date(`${dataFimISO}T00:00:00`);
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
  }

  it.each([7, 30, 90])(
    'chip de %d dias: intervalo <= 90 dias e hoje dentro de [dataInicio, dataFim)',
    (periodoDias) => {
      const { dataInicio, dataFim } = calcularIntervaloPeriodo(periodoDias, HOJE);
      expect(diffDias(dataInicio, dataFim)).toBeLessThanOrEqual(90);
      const hojeISO = '2026-09-15';
      expect(dataInicio <= hojeISO).toBe(true);
      expect(hojeISO < dataFim).toBe(true);
    },
  );

  // Mordida (lu-09-revisao.md G2-2): a conta ANTIGA era
  // dataInicio = hoje - periodoDias (sem o "-1"). Reproduzida aqui como controle —
  // prova que o teste acima MORDE a regressão exata que o achado descreveu.
  it('CONTROLE — a conta antiga (sem -1) estoura 90 dias para o chip de 90', () => {
    const dataInicioAntiga = '2026-06-17'; // hoje(2026-09-15) - 90 dias
    const dataFim = '2026-09-16'; // hoje + 1
    expect(diffDias(dataInicioAntiga, dataFim)).toBe(91);
    expect(diffDias(dataInicioAntiga, dataFim)).toBeGreaterThan(90);
  });

  it('chip de 90 dias produz exatamente o teto (90 dias), não menos', () => {
    const { dataInicio, dataFim } = calcularIntervaloPeriodo(90, HOJE);
    expect(diffDias(dataInicio, dataFim)).toBe(90);
  });

  it('preserva a semântica do dataFim exclusivo (dia seguinte a hoje) — E14', () => {
    const { dataFim } = calcularIntervaloPeriodo(7, HOJE);
    expect(dataFim).toBe('2026-09-16');
  });
});
