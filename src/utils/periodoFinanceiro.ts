// FM-07 (ciclo FIN) — decisão DECLARADA do período dos cards financeiros do dashboard: MÊS
// CORRENTE (ver brief §2.5, "de/ate são obrigatórios, sem default de servidor... escolha o
// período dos cards e declare a escolha — mês corrente é o default natural").
//
// 🔴 O par `{de, ate}` é calculado a partir do CALENDÁRIO LOCAL do dispositivo — primeiro e
// último dia do mês corrente, como o usuário os enxergaria num calendário de parede — e NÃO
// tenta corrigir o fuso do backend (que agrega por dia UTC, limitação DECLARADA e não
// corrigida aqui, ver financeiro.service.ts e FinanceiroController.cs:78-84). As duas coisas
// são independentes: este util decide QUAL par de datas pedir; o que o servidor FAZ com
// esse par (agregação em UTC) é dele, não deste util.
//
// `dia: 0` do mês seguinte é o truque padrão de JS/Date para "último dia do mês corrente"
// (o construtor normaliza dia 0 para o dia anterior ao 1º do mês informado).
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatarDataOnly(ano: number, mesIndex0: number, dia: number): string {
  const d = new Date(ano, mesIndex0, dia);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Primeiro e último dia (inclusivo) do mês corrente, no calendário LOCAL do dispositivo,
 *  como strings `YYYY-MM-DD` (formato `DateOnly` que o backend espera). Aceita uma data de
 *  referência opcional (default: agora) só para tornar a função testável sem mockar `Date`
 *  globalmente. */
export function mesCorrente(referencia: Date = new Date()): { de: string; ate: string } {
  const ano = referencia.getFullYear();
  const mes = referencia.getMonth(); // 0-based
  return {
    de: formatarDataOnly(ano, mes, 1),
    ate: formatarDataOnly(ano, mes + 1, 0), // dia 0 do mês seguinte = último dia deste mês
  };
}
