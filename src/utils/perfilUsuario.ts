// FM-01 — fonte ÚNICA do papel do usuário autenticado no app da clínica.
//
// Precedente copiado de propósito: statusAgendamento.ts (FM-04) concentrou
// union + tradução + apresentação de status de agendamento depois de o
// maestro medir a MESMA cadeia duplicada em 2 lugares. `tpPerfil` é campo
// NOVO do contrato (TokenResponseDto.TpPerfil, backend-clinica-dotnet
// de96c70) — nasce aqui já como union único, em vez de "GESTOR" |
// "VETERINARIO" redigitado em cada arquivo que precisar dele.
//
// Valores reais: `PerfisUsuarioClinica.Gestor` / `PerfisUsuarioClinica.Veterinario`
// (backend-clinica-dotnet, UsuarioClinica.cs:73-77).
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

// Deliberadamente NÃO há um `useIsGestor`/`podeAgirComoVeterinario` aqui.
// Cada tela que precisa decidir "esta ação clínica está disponível?" checa
// `usuario !== null` (a FICHA, não o `tpPerfil`) diretamente — ver
// pacientes/[id].tsx, consulta/[idPet].tsx, receituario/[idPet].tsx. Um
// helper genérico de "render por papel" é escopo da FM-03 (ver relatório
// desta task, seção "o que fica para a FM-03"); construir uma versão
// provisória aqui só criaria algo para a FM-03 desfazer.
