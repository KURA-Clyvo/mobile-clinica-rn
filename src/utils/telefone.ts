// REC-03 — utilitários de telefone para a tela "Novo tutor" + convite.
// Sem dependência de nenhum service/mock: puros, testáveis isoladamente
// (mordida (b) do brief).

export function somenteDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

// G2 REC-03 (I-1, Important): sinal de DDI explícito — o MESMO sinal que
// `NormalizadorTelefone.cs` (backend-clinica-dotnet `origin/main` `e33da98`,
// linha 79: `entrada.TrimStart().StartsWith('+')`) usa para decidir se um
// número é estrangeiro/já-prefixado ou nacional. Ancorado aqui porque as 3
// funções abaixo (`mascararTelefone`/`paraEnvioServidor`/`paraWaMe`) dependem
// da MESMA detecção — duplicá-la seria divergir em silêncio.
export function temPrefixoInternacional(v: string): boolean {
  return v.trimStart().startsWith('+');
}

// Máscara de exibição, aplicada enquanto o usuário digita.
// SEM '+': BR nacional, até 11 dígitos (DDD + número) — comportamento
// original, inalterado. (11) 9123-4567 | (11) 91234-5678
//
// G2b (I-1b, Important — resto do I-1): 12 ou 13 dígitos SEM '+' que
// começam com "55" — a forma em que o número sai de planilha/CRM/export da
// Twilio, ex. `5511987654321` colado — é a forma "já prefixada" que
// `NormalizadorTelefone.cs:93-95` reconhece SOZINHO (ramo 2, sem precisar de
// '+' nenhum). ANTES desta correção, o teto de 11 dígitos do ramo nacional
// truncava isso para `55119876543`, e o servidor (ramo 3) gravava
// `5555119876543` — número inexistente, com o `wa.me` abrindo o mesmo
// número errado. Por isso o teto de 11 dígitos só vale quando o total FICA
// em 11 ou menos — acima disso (12+), mostra os dígitos crus, sem
// agrupamento (mesmo raciocínio do caminho '+': o formato varia demais pra
// valer uma máscara própria).
//
// G2b (m7, Minor): nem aqui nem no ramo '+' há mais TETO — antes, 16+
// dígitos com '+' eram absorvidos em silêncio até 15 (`slice(0,15)`); a
// tecla extra simplesmente não tinha efeito visível, sem nenhum aviso.
// Hoje a máscara deixa crescer e é o ZOD (schema de `novo.tsx`, `<= 15`
// dígitos) quem barra com mensagem — errar deixa de ser silencioso.
export function mascararTelefone(v: string): string {
  if (temPrefixoInternacional(v)) {
    const d = somenteDigitos(v);
    return d.length === 0 ? '+' : `+${d}`;
  }
  const d = somenteDigitos(v);
  if (d.length <= 11) {
    if (d.length === 0) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  return d;
}

// G2 REC-03 (I-1): o valor que VAI PARA O SERVIDOR precisa preservar o '+'
// quando presente — é esse sinal (não o comprimento) que
// `NormalizadorTelefone.TentarNormalizar` usa para escolher entre "guarda os
// dígitos como vieram" (ramo 1, DDI explícito) e "prefixa 55" (ramo 3,
// nacional). ANTES desta correção `criarTutor` chamava `somenteDigitos` puro
// — tirava o '+' e entregava só dígitos, então um estrangeiro de 11-13
// dígitos era lido pelo servidor como nacional brasileiro (ramo 3), virando
// "55" + número errado. Sem '+' na entrada, o resultado é só dígitos (mesmo
// comportamento de sempre — o servidor decide sozinho pelo comprimento).
export function paraEnvioServidor(v: string): string {
  const d = somenteDigitos(v);
  return temPrefixoInternacional(v) ? `+${d}` : d;
}

// wa.me exige só dígitos (sem '+') COM código do país embutido.
// SEM '+' na entrada: número com até 11 dígitos (DDD + número, nacional) —
// prefixa 55; um valor que já chegue com mais dígitos SEM '+' (ex.: já
// normalizado pelo servidor, 12-13 dígitos começando com 55) é mantido como
// está, sem prefixar de novo.
// COM '+' (G2, I-1): o '+' já sinaliza "código do país embutido" — usa os
// dígitos como estão, SEM somar 55 (bug corrigido: antes o '+' era
// descartado e um estrangeiro de ≤11 dígitos ganhava um 55 espúrio).
export function paraWaMe(numero: string): string {
  const d = somenteDigitos(numero);
  if (temPrefixoInternacional(numero)) return d;
  return d.length <= 11 ? `55${d}` : d;
}

// Monta o link completo do wa.me, com o texto codificado — mordida (b): o
// número precisa estar NORMALIZADO (só dígitos + código do país) e a
// mensagem precisa estar CODIFICADA (espaços, acentos, quebras de linha não
// podem vazar cru para a query string).
export function linkWhatsApp(numero: string, mensagem: string): string {
  return `https://wa.me/${paraWaMe(numero)}?text=${encodeURIComponent(mensagem)}`;
}
