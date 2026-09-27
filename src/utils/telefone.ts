// REC-03 — utilitários de telefone para a tela "Novo tutor" + convite.
// Sem dependência de nenhum service/mock: puros, testáveis isoladamente
// (mordida (b) do brief).

export function somenteDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

// Máscara de exibição BR, aplicada enquanto o usuário digita — nunca o que é
// enviado ao backend (que recebe somenteDigitos() do valor mascarado).
// (11) 9123-4567  |  (11) 91234-5678
export function mascararTelefone(v: string): string {
  const d = somenteDigitos(v).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// wa.me exige código do país. Números com até 11 dígitos (DDD + número, o
// formato que o .NET armazena — NormalizadorTelefone, 10-15 dígitos) são
// tratados como BR e recebem o prefixo 55; um valor que já chegue com mais
// dígitos (alguém já incluiu o código do país) é mantido como está.
export function paraWaMe(numero: string): string {
  const d = somenteDigitos(numero);
  return d.length <= 11 ? `55${d}` : d;
}

// Monta o link completo do wa.me, com o texto codificado — mordida (b): o
// número precisa estar NORMALIZADO (só dígitos + código do país) e a
// mensagem precisa estar CODIFICADA (espaços, acentos, quebras de linha não
// podem vazar cru para a query string).
export function linkWhatsApp(numero: string, mensagem: string): string {
  return `https://wa.me/${paraWaMe(numero)}?text=${encodeURIComponent(mensagem)}`;
}
