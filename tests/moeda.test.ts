import { formatarMoeda, formatarPercentual } from '../src/utils/moeda';

// FM-05 — o separador entre "R$" e o número é NBSP (` `) na saída real
// de `Intl.NumberFormat('pt-BR', ...)` desta engine (medido:
// `[...f.format(150)].map(c=>c.charCodeAt(0))` -> 160 no lugar do espaço).
// `\s` no regex casa NBSP (classe de espaço em branco do ECMAScript), então
// os testes abaixo não travam num caractere de separador específico —
// robustez contra a ICU do ambiente variar entre máquinas/CI.
describe('formatarMoeda', () => {
  it('formata valor inteiro em reais', () => {
    expect(formatarMoeda(150)).toMatch(/^R\$\s*150,00$/);
  });

  it('formata valor com centavos', () => {
    expect(formatarMoeda(90.5)).toMatch(/^R\$\s*90,50$/);
  });

  it('formata zero', () => {
    expect(formatarMoeda(0)).toMatch(/^R\$\s*0,00$/);
  });

  it('formata milhar com separador de milhar pt-BR', () => {
    expect(formatarMoeda(1234.5)).toMatch(/^R\$\s*1\.234,50$/);
  });

  it('arredonda para 2 casas decimais na exibição (NÃO é o piso de precisão do backend)', () => {
    // Só formatação de exibição -- a task NÃO soma/recalcula preço no
    // cliente (ver comentário de moeda.ts e de ServicoPrecoResponseDto no
    // backend). 10.005 arredonda para 10,01 pela regra padrão de exibição
    // do Intl (round-half-to-even/half-up depende da engine) -- o teste só
    // confirma 2 casas, não um algoritmo de arredondamento específico.
    expect(formatarMoeda(10.005)).toMatch(/^R\$\s*10,0[01]$/);
  });
});

// FM-08 — `variacaoPercentual` do backend já é o NÚMERO da porcentagem (21.12 = "21,12%"),
// não a fração 0.21. Estes testes travam que o formatador NÃO multiplica por 100 de novo
// (o erro óbvio de usar `Intl.NumberFormat({style:'percent'})` direto num valor que já é
// porcentagem) e que ele só troca o separador decimal, sem re-arredondar.
describe('formatarPercentual', () => {
  it('formata positivo com sinal +', () => {
    expect(formatarPercentual(21.12)).toBe('+21,12%');
  });

  it('formata negativo com o sinal - já embutido (não duplica sinal)', () => {
    expect(formatarPercentual(-5.5)).toBe('-5,50%');
  });

  it('formata zero sem sinal', () => {
    expect(formatarPercentual(0)).toBe('0,00%');
  });

  it('NÃO multiplica por 100 -- 21.12 vira "21,12%", nunca "2112,00%"', () => {
    expect(formatarPercentual(21.12)).not.toContain('2112');
  });
});
