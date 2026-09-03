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

const MESES_CURTOS_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

/**
 * Formata para exibição um par `DateOnly` (`YYYY-MM-DD`) vindo do backend.
 *
 * 🔴 NÃO usa `new Date(str)` de propósito, e isso não é preferência de estilo.
 * `new Date('2026-09-01')` é parseado como **UTC meia-noite**, e `getDate()`
 * num fuso negativo (BRT é UTC-3) devolve o **dia anterior**. Medido nesta
 * máquina: `new Date('2026-09-01').getDate()` === 31 e `.getMonth()` === 7
 * (agosto). Ou seja, formatar com `formatDateShort()` mostraria
 * "31 Ago 2026" como início de um período que começa em **1º de setembro**.
 *
 * ⚠️ É a mesma família do defeito que esta seção existe para evitar: um número
 * (aqui, uma data) plausível, sem erro nenhum, descrevendo outro período. Por
 * isso a string é fatiada, nunca parseada.
 */
export function formatarPeriodoCurto(de: string, ate: string): string {
  const rotulo = (dateOnly: string): string => {
    const [ano, mes, dia] = dateOnly.split('-');
    const mesIndex = Number(mes) - 1;
    const nome = MESES_CURTOS_PT[mesIndex] ?? mes;
    return `${dia} ${nome} ${ano}`;
  };
  return `${rotulo(de)} – ${rotulo(ate)}`;
}
