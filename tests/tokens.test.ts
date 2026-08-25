// CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — fix wave 2a, Achado 1 da
// revisão G2: nenhum teste fixava o literal `touchTarget.min = 44`.
// Reproduzido pela G2: trocar `44` por `24` em `src/theme/tokens.ts` deixava
// a suíte INTEIRA verde (57/57) — o guarda de `tests/touch-target-coverage.
// test.ts` protege contra violar um mínimo que nada trava, e a mesma
// constante alimenta `KCChip.interactive` (CQ-07) e `KCButton`, então baixar
// o token encolhe os componentes em silêncio.
//
// Trava por IGUALDADE exata (`toBe(44)`), não `toBeGreaterThanOrEqual` — de
// propósito (v12, mordida por mutação cruzada, não só remoção): um teste
// `>= 44` continuaria VERDE se alguém subisse o valor pra 60, porque 60 >=
// 44 também é verdadeiro. Não é essa a trava que este teste precisa dar —
// mudar a META (pra cima OU pra baixo) tem que ser deliberado, nunca
// silencioso. Se o piso mudar de propósito no futuro, este teste TEM que
// ser editado — esse é o ponto: tornar a mudança visível no diff, não
// impedi-la.
//
// Por que 44 e não 24: WCAG 2.2 SC 2.5.8 (AA) exige só 24×24 CSS px; SC
// 2.5.5 (AAA) e a prática de mercado pedem 44×44 — a razão de este projeto
// ter escolhido a meta AAA já está comentada em `src/theme/tokens.ts`
// (`touchTarget`), não repetida aqui além do necessário para justificar o
// valor travado.
import { touchTarget } from '../src/theme/tokens';

describe('touchTarget.min — piso WCAG travado por igualdade exata (CQ-08, achado 1 da G2)', () => {
  it('é exatamente 44 — nem 24 (piso AA, abaixo da meta AAA deste projeto) nem qualquer outro valor', () => {
    expect(touchTarget.min).toBe(44);
  });
});
