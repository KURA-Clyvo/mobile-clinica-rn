// FM-01 — fonte ÚNICA do papel do usuário autenticado no app da clínica.
//
// Precedente copiado de propósito: statusAgendamento.ts (FM-04) concentrou
// union + tradução + apresentação de status de agendamento depois de o
// maestro medir a MESMA cadeia duplicada em 2 lugares. `tpPerfil` é campo
// NOVO do contrato (TokenResponseDto.TpPerfil, backend-clinica-dotnet
// de96c70) — nasce aqui já como union único, em vez de "GESTOR" |
// "VETERINARIO" redigitado em cada arquivo que precisar dele.
//
// Valores reais: `PerfisUsuarioClinica.Gestor` / `PerfisUsuarioClinica.Veterinario`.
//
// 🔴 PIN DE CONTRATO CROSS-REPO — leia antes de editar esta union. FM-09 (item 7):
// citação sem âncora completa (regra de ouro v7 do CLAUDE.md deste ecossistema —
// cópia sem arquivo:linha+commit+data não é conferível).
//
// FONTE:   backend-clinica-dotnet
//          src/Kura.Domain/Entities/UsuarioClinica.cs:73-77
//          (`PerfisUsuarioClinica` — 2 constantes, "GESTOR"/"VETERINARIO", que
//          alimentam `CHK_USUARIO_CLINICA_PERFIL`, ver âncora abaixo.)
// COMMIT:  81ac01c  (`main`, pós-merge FD-17)
// CONFERIDO EM: 2026-09-04 — bate linha a linha com a fonte nesse commit; conferido
//   também contra a CHECK constraint real do banco (não só o enum C#, que poderia
//   divergir do schema): `CHK_USUARIO_CLINICA_PERFIL` em
//   backend-tutor-java/src/main/resources/db/migration-oracle/V17__usuario_clinica.sql:125
//   (commit `2d3ffc5`, `main`) — `CHECK (TP_PERFIL IN ('GESTOR','VETERINARIO'))`,
//   exatamente 2 valores, sem terceiro papel latente (ex.: RECEPCIONISTA é citado
//   no comentário da migration só como EXEMPLO FUTURO, não implementado).
//
// COMO RECONFERIR:
//   git -C ../backend-clinica-dotnet show 81ac01c:src/Kura.Domain/Entities/UsuarioClinica.cs \
//     | sed -n '73,77p'
//   git -C ../backend-tutor-java show 2d3ffc5:src/main/resources/db/migration-oracle/V17__usuario_clinica.sql \
//     | sed -n '125p'
//
// Deliberadamente REESCRITA aqui, não importada — os dois repos não compartilham
// código. Cópia à mão, regra de ouro v7: sem esta âncora, "espelha o backend" não é
// conferível por ninguém.
export type TipoPerfilUsuario = 'GESTOR' | 'VETERINARIO';

const PERFIL_LABEL: Record<TipoPerfilUsuario, string> = {
  GESTOR: 'Gestor',
  VETERINARIO: 'Veterinário',
};

// Usado por settings.tsx (linha "Perfil"). `null` cobre o estado antes da
// hidratação do store (_hasHydrated) — não deveria aparecer em uso normal
// pós-login, mas a assinatura reflete o tipo real do store, não um
// otimismo de runtime.
export function perfilLabel(tpPerfil: TipoPerfilUsuario | null): string {
  if (tpPerfil === null) return '—';
  return PERFIL_LABEL[tpPerfil];
}

// FM-01 — nome de exibição APROXIMADO, para quando não há ficha de
// veterinário. Um GESTOR sem vínculo não tem `nmVeterinario`, e o `.NET` não
// devolve o e-mail no corpo quando `usuario` é nulo (só dentro do JWT, que
// este app deliberadamente não decodifica) — mas o app tem o e-mail que a
// PESSOA DIGITOU no login, guardado no store.
//
// ⚠️ Isto é um IDENTIFICADOR, não o nome da pessoa. Só é usado onde errar
// custa zero — a saudação do dashboard. Onde autoria importa (`idVeterinario`
// de consulta e receituário) a resposta continua sendo EXIGIR ficha, nunca
// aproximar: autoria ERRADA é estritamente pior que autoria ausente. É o
// mesmo princípio que fez o `.NET` MATAR a heurística de fallback do login
// (AuthService.cs:100-102) em vez de adivinhar o vínculo.
//
// `null`/vazio devolve string vazia, e quem chama decide o que fazer com ela
// (o dashboard omite a vírgula e mostra só "Boa noite").
export function primeiroNomeDeEmail(email: string | null): string {
  if (!email) return '';
  const local = email.split('@')[0] ?? '';
  // Separadores comuns em e-mail corporativo: felipe.ferrete / felipe_ferrete
  // / felipe-ferrete -> "Felipe". Sem separador, o local inteiro.
  const primeiro = local.split(/[._-]/).filter(Boolean)[0] ?? '';
  if (!primeiro) return '';
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1);
}

// Deliberadamente NÃO há um `useIsGestor`/`podeAgirComoVeterinario` aqui.
// Cada tela que precisa decidir "esta ação clínica está disponível?" checa
// `usuario !== null` (a FICHA, não o `tpPerfil`) diretamente — ver
// pacientes/[id].tsx, consulta/[idPet].tsx, receituario/[idPet].tsx. Um
// helper genérico de "render por papel" é escopo da FM-03 (ver relatório
// desta task, seção "o que fica para a FM-03"); construir uma versão
// provisória aqui só criaria algo para a FM-03 desfazer.
