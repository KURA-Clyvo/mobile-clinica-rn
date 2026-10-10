// REC-03 (KURA_BACKLOG_RECEPCAO.md) — máscaras de exibição para os campos de CPF e
// telefone da tela "Novo tutor". Puramente cosméticas: o valor mascarado vai DIRETO no
// corpo da requisição (ver comentário em tutores.service.ts::criarTutor) — o
// NormalizadorTelefone real (backend-clinica-dotnet) extrai os dígitos e tolera
// parênteses/espaço/hífen; só o CPF é enviado sem máscara (`nrCpf.replace(/\D/g, '')`
// no service, mesma convenção de NrCpf `Length(11)` no validator .NET).
//
// Telefone com `+` explícito (estrangeiro, ver NormalizadorTelefone) NÃO é mascarado —
// o usuário digita livremente; mascarar destruiria o `+` que o servidor exige para não
// tratar a entrada como nacional brasileiro.

export function mascararCpf(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  let out = digitos.slice(0, 3);
  if (digitos.length > 3) out += '.' + digitos.slice(3, 6);
  if (digitos.length > 6) out += '.' + digitos.slice(6, 9);
  if (digitos.length > 9) out += '-' + digitos.slice(9, 11);
  return out;
}

export function mascararTelefone(valor: string): string {
  if (valor.trim().startsWith('+')) return valor;

  const digitos = valor.replace(/\D/g, '').slice(0, 11);
  if (digitos.length === 0) return '';
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`;
}
