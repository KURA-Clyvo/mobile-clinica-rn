import type { InternalAxiosRequestConfig } from 'axios';
import type { LoginResponse, RegisterClinicaRequest, RegisterClinicaResponse, VeterinarioResponse } from '../types/api';

export const mockVeterinario: VeterinarioResponse = {
  id: 1,
  nmVeterinario: 'Dr. Felipe Ferrete',
  nrCRMV: 'SP-12345',
  dsEmail: 'felipe.ferrete@kuraclinica.com.br',
  dsTelefone: '11998880001',
  dsEspecialidade: 'Clínica Geral e Cirurgia',
  dsBio: 'Médico-Veterinário formado pela USP com especialização em Cirurgia de Tecidos Moles.',
  dsFotoUrl: undefined,
};

// FM-01 — achado latente medido na FM-04, confirmado na revisão G2 dela:
// `config.data` que chega até um handler de mock PELA CADEIA REAL do
// apiClient (request interceptor rejeita ANTES da serialização do axios —
// ver services/api/client.ts::buildRequestInterceptor) é o objeto JS
// original passado a `apiClient.post(url, data)`, NUNCA uma string JSON.
// `JSON.parse(objeto)` não lança — `String(objeto)` vira "[object Object]",
// que `JSON.parse` rejeita com SyntaxError — então `register()` quebrava
// toda vez que fosse exercitado pela cadeia real (nenhum teste desta
// suíte fazia isso antes de mock-contract-audit.test.ts::register, FM-01).
// Só um teste que monta `config.data` como STRING à mão (nunca a cadeia
// real) escondia o defeito. `parseBody` aceita as duas formas.
function parseBody<T>(data: unknown): T {
  if (typeof data === 'string') {
    return JSON.parse(data || '{}') as T;
  }
  return (data ?? {}) as T;
}

// 🔴 FM-09 (fechamento do gate) — O PAPEL DE QUEM ENTRA PASSOU A DEPENDER DO E-MAIL.
//
// Histórico, e ele é a razão desta mudança existir: até aqui este handler devolvia SEMPRE
// `VETERINARIO` com ficha completa, ignorando o payload. A FM-04 tinha decidido isso de
// propósito ("simular GESTOR-sem-ficha exigiria inspecionar `dsEmail`... sem necessidade real
// de demonstração"), e a decisão era defensável NAQUELE momento.
//
// O que a tornou insuficiente: o gate FM-09 exige percorrer, EM RUNTIME, o caminho de um
// VETERINARIO sem ficha (criado pela tela da FM-02) e o de um GESTOR sem ficha. Com o handler
// antigo esse percurso era IMPOSSÍVEL no modo padrão versionado (`EXPO_PUBLIC_USE_MOCKS=true`):
// qualquer credencial entrava como a mesma pessoa. ⇒ O critério de aceite exigia um percurso
// que o ambiente não podia produzir — e um gate que cobra o que o ambiente não permite não é
// um gate, é uma formalidade.
//
// A CONVENÇÃO (demo-only, e deliberadamente por SUBSTRING para não virar uma lista de e-mails
// que apodrece — regra de ouro v7 deste ecossistema: inventário escrito à mão apodrece em
// silêncio):
//   e-mail contém 'gestor'   -> tpPerfil GESTOR
//   e-mail contém 'semficha' -> usuario: null  (sem vínculo em VETERINARIO)
//   qualquer outro           -> VETERINARIO com ficha completa   <- DEFAULT INALTERADO
//
// ⚠️ O default é o comportamento antigo, byte a byte: quem não usa a convenção não percebe
// diferença nenhuma, e nenhuma demonstração existente muda.
//
// 🔴 `tpPerfil` vem SEMPRE, inclusive quando `usuario` é null — é o que torna "sem ficha"
// interpretável em vez de indistinguível de erro (ver types/api.ts::LoginResponse:12-17, que
// documenta exatamente essa garantia do TokenResponseDto real).
//
// ⛔ NÃO replica o backend real, e isto é declarado, não escondido: lá o papel vem de
// USUARIO_CLINICA.TP_PERFIL e a ficha do vínculo com VETERINARIO — nada a ver com o texto do
// e-mail. Esta convenção existe SÓ para tornar os 4 estados alcançáveis numa demonstração.
export async function login(config: InternalAxiosRequestConfig): Promise<LoginResponse> {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { dsEmail } = parseBody<{ dsEmail?: string }>(config.data);
  const email = (dsEmail ?? '').toLowerCase();
  return {
    accessToken: 'kura_mock_jwt_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    expiresAt,
    tpPerfil: email.includes('gestor') ? 'GESTOR' : 'VETERINARIO',
    usuario: email.includes('semficha') ? null : mockVeterinario,
  };
}

export async function register(config: InternalAxiosRequestConfig): Promise<RegisterClinicaResponse> {
  const body = parseBody<RegisterClinicaRequest>(config.data);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    idClinica: 1,
    idVeterinarioAdmin: 2,
    accessToken: 'kura_mock_jwt_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    expiresAt,
    // 🔴 PIN DE CONTRATO CROSS-REPO — leia antes de editar este literal. FM-09 (item 7):
    // citação sem âncora completa (regra de ouro v7 do CLAUDE.md deste ecossistema).
    //
    // FONTE:   backend-clinica-dotnet
    //          src/Kura.Application/Services/AuthService.cs:336
    //          (`RegisterClinicaAsync`, o `return new RegisterClinicaResponseDto {...}`
    //          final do método — `TpPerfil = PerfisUsuarioClinica.Gestor`, hardcoded, sem
    //          ramo condicional. Confirmado que não é só o doc-comment do DTO
    //          (`RegisterClinicaResponseDto.cs:16-19`, que já dizia "é sempre GESTOR") --
    //          o SERVICE que preenche o campo também não tem outro caminho: o mesmo
    //          literal aparece de novo em :306, na criação do `UsuarioClinica` gravado
    //          na mesma transação — as duas ocorrências concordam.)
    // COMMIT:  81ac01c  (`main`, pós-merge FD-17)
    // CONFERIDO EM: 2026-09-04 — bate linha a linha com a fonte nesse commit.
    //
    // COMO RECONFERIR:
    //   git -C ../backend-clinica-dotnet show 81ac01c:src/Kura.Application/Services/AuthService.cs \
    //     | sed -n '300,340p'
    //
    // Deliberadamente REESCRITA aqui, não importada — os dois repos não compartilham
    // código. Cópia à mão, regra de ouro v7.
    tpPerfil: 'GESTOR',
    usuario: {
      id: 2,
      nmVeterinario: body.nmVeterinarioAdmin,
      nrCRMV: body.nrCRMV,
      dsEmail: body.dsEmailAcesso,
    },
  };
}
