jest.mock('@services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  lunaClient: { get: jest.fn(), post: jest.fn() },
}));

import { apiClient } from '../src/services/api/client';
import { login, logout, registerClinica } from '../src/services/auth.service';
import type { LoginRequest, RegisterClinicaRequest } from '../src/types/api';

const mockApiPost = apiClient.post as jest.Mock;

const MOCK_LOGIN_RESPONSE = {
  accessToken: 'jwt-token-abc',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  usuario: {
    id: 1,
    idClinica: 10,
    nmVeterinario: 'Dr. Felipe Ferrete',
    nrCRMV: 'SP-12345',
    dsEmail: 'felipe@kuraclinica.com.br',
  },
};

const MOCK_REGISTER_RESPONSE = {
  idClinica: 1,
  nmClinica: 'Clínica Kura',
  dsEmailAcesso: 'felipe@kuraclinica.com.br',
  dtCriacao: new Date().toISOString(),
  idVeterinarioAdmin: 2,
  accessToken: 'jwt-token-register',
  expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  usuario: {
    id: 2,
    idClinica: 1,
    nmVeterinario: 'Dr. Felipe Ferrete',
    nrCRMV: 'SP-12345',
    dsEmail: 'felipe@kuraclinica.com.br',
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auth.service', () => {
  it('login calls apiClient.post with the correct URL and payload', async () => {
    mockApiPost.mockResolvedValue({ data: MOCK_LOGIN_RESPONSE });

    const req: LoginRequest = { dsEmail: 'felipe@kuraclinica.com.br', dsSenha: 'senha123' };
    const result = await login(req);

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/auth/login', req);
    expect(result).toEqual(MOCK_LOGIN_RESPONSE);
  });

  it('registerClinica calls apiClient.post with the correct URL and payload', async () => {
    mockApiPost.mockResolvedValue({ data: MOCK_REGISTER_RESPONSE });

    const req: RegisterClinicaRequest = {
      nmClinica: 'Clínica Kura',
      nrCnpj: '12345678000199',
      dsEndereco: 'Rua das Flores, 123',
      nmCidade: 'São Paulo',
      sgUf: 'SP',
      nrCep: '01234567',
      nrTelefone: '11987654321',
      dsEmail: 'contato@kuraclinica.com.br',
      dsEmailAcesso: 'felipe@kuraclinica.com.br',
      dsSenha: 'senha123',
      nmVeterinarioAdmin: 'Dr. Felipe Ferrete',
      nrCRMV: 'SP-12345',
    };
    const result = await registerClinica(req);

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/auth/register-clinica', req);
    expect(result).toEqual(MOCK_REGISTER_RESPONSE);
  });

  it('logout resolves without calling apiClient (no real endpoint exists)', async () => {
    await expect(logout()).resolves.toBeUndefined();
    expect(mockApiPost).not.toHaveBeenCalled();
  });
});
