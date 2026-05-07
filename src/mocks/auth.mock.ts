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

export async function login(_config: InternalAxiosRequestConfig): Promise<LoginResponse> {
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    accessToken: 'kura_mock_jwt_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    expiresAt,
    usuario: mockVeterinario,
  };
}

export async function register(config: InternalAxiosRequestConfig): Promise<RegisterClinicaResponse> {
  const body = JSON.parse(config.data ?? '{}') as RegisterClinicaRequest;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    idClinica: 1,
    idVeterinarioAdmin: 2,
    accessToken: 'kura_mock_jwt_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    expiresAt,
    usuario: {
      id: 2,
      nmVeterinario: body.nmVeterinarioAdmin,
      nrCRMV: body.nrCRMV,
      dsEmail: body.dsEmailAdmin,
    },
  };
}
