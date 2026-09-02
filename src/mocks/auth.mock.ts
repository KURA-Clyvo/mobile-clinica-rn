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

// Cenário fixo do mock: veterinário com ficha completa (paridade com o
// comportamento pré-FM-01, quando `usuario` nunca era nulo). Não há troca
// de papel via payload aqui — o app não decodifica JWT, e simular
// GESTOR-sem-ficha em modo mock exigiria inspecionar `dsEmail` para
// decidir a resposta, o que a FM-04 evitou fazer sem necessidade real de
// demonstração. Os testes que precisam de um GESTOR sem vínculo semeiam o
// authStore diretamente (ver tests/authStore.test.ts, DashboardScreen.test.tsx,
// NavDrawer.test.tsx etc.) — não passam por este mock.
export async function login(_config: InternalAxiosRequestConfig): Promise<LoginResponse> {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    accessToken: 'kura_mock_jwt_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    expiresAt,
    tpPerfil: 'VETERINARIO',
    usuario: mockVeterinario,
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
    // Espelha o contrato real: registro de clínica é sempre GESTOR
    // (RegisterClinicaResponseDto.TpPerfil, sempre 'GESTOR').
    tpPerfil: 'GESTOR',
    usuario: {
      id: 2,
      nmVeterinario: body.nmVeterinarioAdmin,
      nrCRMV: body.nrCRMV,
      dsEmail: body.dsEmailAcesso,
    },
  };
}
