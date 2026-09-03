import { formatarMoeda } from '../src/utils/moeda';

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
