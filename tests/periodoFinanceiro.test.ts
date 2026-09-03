import { mesCorrente, formatarPeriodoCurto } from '../src/utils/periodoFinanceiro';

// ─── I-4 da revisão G2 da FM-07 ──────────────────────────────────────────────
//
// 🔴 `periodoFinanceiro.ts` chegou à revisão com ZERO testes, e a G2 provou o
// custo disso por mutação: alterou o cálculo para o mês colapsar em 1 dia e a
// suíte inteira ficou **980/980 verde**.
//
// ⚠️ O que torna essa ausência cara não é o tamanho do arquivo (34 linhas), é o
// que ele decide: **QUAL par de datas o app pede ao backend**. Um erro aqui não
// quebra nada — ele devolve `200 OK` com números de OUTRO período, exatamente o
// defeito que o `FinanceiroController` recusa a facilitar quando se nega a ter
// default de servidor ("um cliente que esquecesse o período receberia 200 com
// números plausíveis de OUTRO período"). O app tem a mesma obrigação do lado de
// cá, e nada a vigiava.
//
// A função aceita `referencia` justamente para ser testável sem mockar `Date`
// global — o que também evita a armadilha deste repo de que **Node ignora nome
// IANA em `TZ` no Windows**, então fixar fuso por env var não funcionaria aqui.
// Todas as datas abaixo são construídas no calendário LOCAL, que é o que a
// função lê (`getFullYear`/`getMonth`).

describe('mesCorrente — o par {de, ate} que o dashboard pede ao backend', () => {
  it('devolve o primeiro e o último dia do mês, no formato DateOnly YYYY-MM-DD', () => {
    expect(mesCorrente(new Date(2026, 8, 3))).toEqual({ de: '2026-09-01', ate: '2026-09-30' });
  });

  // Controle positivo do formato: o backend recusa com 400 qualquer coisa que
  // não seja YYYY-MM-DD, então zero à esquerda não é cosmético.
  it('zera à esquerda mês e dia de um dígito', () => {
    const { de, ate } = mesCorrente(new Date(2026, 0, 15));
    expect(de).toBe('2026-01-01');
    expect(ate).toBe('2026-01-31');
    expect(de).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(ate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // 🔴 A mordida que a mutação da G2 atravessou: se o cálculo colapsar, `de` e
  // `ate` viram o mesmo dia — e o backend ACEITA isso (`de == ate` é um
  // relatório de um dia, válido). Nenhum erro, nenhum 400: só um card mostrando
  // o faturamento de um dia com o rótulo do mês.
  it('o intervalo NÃO colapsa: ate é estritamente depois de de num mês de 30/31 dias', () => {
    for (const mes of [0, 1, 3, 8, 11]) {
      const { de, ate } = mesCorrente(new Date(2026, mes, 10));
      expect(ate > de).toBe(true);
      expect(Number(ate.slice(-2))).toBeGreaterThanOrEqual(28);
    }
  });

  it('fevereiro de ano bissexto termina em 29; de ano comum, em 28', () => {
    expect(mesCorrente(new Date(2024, 1, 10)).ate).toBe('2024-02-29');
    expect(mesCorrente(new Date(2026, 1, 10)).ate).toBe('2026-02-28');
  });

  // Dezembro é o caso em que o truque `dia 0 do mês seguinte` cruza o ANO. Se
  // a implementação somasse 1 ao mês sem deixar o `Date` normalizar, aqui
  // apareceria mês 13 ou o ano errado.
  it('dezembro não vaza para o ano seguinte', () => {
    expect(mesCorrente(new Date(2026, 11, 20))).toEqual({ de: '2026-12-01', ate: '2026-12-31' });
  });

  // Bordas do próprio mês: o resultado não pode depender do DIA da referência,
  // só do mês. É o invariante que um off-by-one no `de` quebraria primeiro.
  it('o resultado depende do MÊS da referência, nunca do dia dentro dele', () => {
    const primeiro = mesCorrente(new Date(2026, 6, 1));
    const meio = mesCorrente(new Date(2026, 6, 17));
    const ultimo = mesCorrente(new Date(2026, 6, 31));
    expect(meio).toEqual(primeiro);
    expect(ultimo).toEqual(primeiro);
    expect(primeiro).toEqual({ de: '2026-07-01', ate: '2026-07-31' });
  });
});

// ─── I-3 da revisão G2: a tela precisa DIZER de que período são os números ───
//
// O contrato do backend devolve `periodo` com estas palavras: é "para que o app
// confira em vez de acreditar" -- e a tela ignorava o campo inteiro. Agravante
// medido pela G2: o topo do dashboard mostra a data de HOJE, então o gestor
// tinha um número mensal ao lado de uma data diária, sem nada ligando os dois.
describe('formatarPeriodoCurto — o rótulo do período exibido', () => {
  it('formata o par DateOnly num intervalo legível', () => {
    expect(formatarPeriodoCurto('2026-09-01', '2026-09-30')).toBe('01 set 2026 – 30 set 2026');
  });

  // 🔴 A MORDIDA: `new Date('2026-09-01')` é parseado como UTC meia-noite, e
  // `.getDate()` num fuso negativo devolve o DIA ANTERIOR. Medido nesta
  // máquina: `getDate()` === 31 e `getMonth()` === 7 (agosto).
  //
  // ⇒ Se alguém "simplificar" este formatador para usar `new Date(...)` +
  // `formatDateShort()`, o rótulo passa a dizer "31 Ago" para um período que
  // começa em 1º de SETEMBRO. Sem erro, sem warning: só uma data plausível
  // descrevendo outro período -- a mesma família do defeito que esta seção
  // inteira existe para evitar.
  it('NÃO desloca o dia por parse UTC — controle positivo junto', () => {
    // Controle positivo: prova que a armadilha é real nesta máquina, e não uma
    // preocupação teórica. Se este expect falhar, o ambiente mudou e a
    // justificativa do formatador precisa ser reavaliada, não o formatador.
    expect(new Date('2026-09-01').getDate()).not.toBe(1);

    // E o formatador, que fatia a string em vez de parseá-la, acerta.
    expect(formatarPeriodoCurto('2026-09-01', '2026-09-30')).toContain('01 set');
    expect(formatarPeriodoCurto('2026-01-01', '2026-01-31')).toContain('01 jan');
    expect(formatarPeriodoCurto('2026-03-01', '2026-03-31')).toContain('31 mar');
  });
});
