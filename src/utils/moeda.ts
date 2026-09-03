// FM-05 (KURA_BACKLOG_FIN, ciclo metade cliente) — helper de formatação de
// moeda, NOVO neste repo (medido antes de escrever: `grep -rn
// "Intl.NumberFormat" src/` -> 0 linhas). A tabela de preços é a primeira
// tela deste app a exibir `VL_PRECO`/`VL_COBRADO` (campos monetários reais
// do domínio financeiro do ciclo FIN) — FM-07/FM-08 devem REUSAR este
// helper em vez de duplicar `Intl.NumberFormat` em cada tela nova.
//
// 🔴 `VlPreco` (e qualquer outro campo `Vl*` do backend) é `decimal` no C#
// -> chega como `number` puro em JSON, sem envelope de precisão. Isso é
// SEGURO para EXIBIR (o que este helper faz) e NÃO é seguro para somar/
// recalcular no cliente (erro de ponto flutuante) — nenhuma tela que
// consome este helper deve reimplementar aritmética monetária em JS; ver
// `ServicoPrecoResponseDto` (backend-clinica-dotnet) para o comentário
// equivalente do lado do servidor.
const formatadorReal = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/** Formata um valor monetário (já em reais, nunca centavos) como BRL
 *  (`Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`).
 *  Puro exibição — não arredonda para fins de cálculo, só para o texto. */
export function formatarMoeda(valor: number): string {
  return formatadorReal.format(valor);
}
