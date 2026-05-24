import type {
  LoginRequest,
  LoginResponse,
  RegisterClinicaRequest,
  RegisterClinicaResponse,
} from '../types/api';

async function delay(ms = 800) {
  return new Promise(r => setTimeout(r, ms));
}

export async function login(data: LoginRequest): Promise<LoginResponse> {
  await delay();

  if (data.dsEmail === 'gui@kura.com' && data.dsSenha === '123456') {
    return {
      accessToken: 'mock-token-abc',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      usuario: {
        id: 1,
        nmVeterinario: 'Guilherme Sola',
        nrCRMV: '12345-SP',
        dsEmail: data.dsEmail,
      },
    };
  }

  throw { status: 401 };
}

export async function logout(): Promise<void> {}

export async function registerClinica(
  data: RegisterClinicaRequest,
): Promise<RegisterClinicaResponse> {
  await delay();

  return {
    idClinica: 1,
    idVeterinarioAdmin: 2,
    accessToken: 'mock-token-register',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    usuario: {
      id: 2,
      nmVeterinario: data.nmVeterinarioAdmin,
      nrCRMV: data.nrCRMV,
      dsEmail: data.dsEmailAdmin,
    },
  };
}