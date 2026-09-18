// Cena 2E do roteiro da banca ("receita em PDF — navegador"): na web o
// downloadFileAsync do expo-file-system é um no-op que só loga warning, então o botão
// de baixar a receita não fazia nada. Estes testes travam o ramo web.
jest.mock('@services/api/client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
  AUTH_TOKEN_KEY: 'KURA_AUTH_TOKEN',
}));
jest.mock('expo-file-system', () => ({
  File: Object.assign(jest.fn(), { downloadFileAsync: jest.fn() }),
  Paths: { cache: '/cache' },
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { apiClient } from '../src/services/api/client';
import { baixarEAbrirReceituario } from '../src/services/eventos-clinicos.service';
import type { DocumentoResponse } from '../src/services/eventos-clinicos.service';

const mockGet = apiClient.get as jest.Mock;
const documento = {
  id: 7,
  nmArquivo: 'receita-thor.pdf',
  dsTipoMime: 'application/pdf',
} as DocumentoResponse;

const createObjectURL = jest.fn(() => 'blob:receita');
const revokeObjectURL = jest.fn();
const windowOpen = jest.fn();
const clickLink = jest.fn();

const plataformaOriginal = Platform.OS;
afterAll(() => {
  Object.defineProperty(Platform, 'OS', { value: plataformaOriginal, configurable: true });
});

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  Object.assign(globalThis, {
    window: { open: windowOpen },
    document: {
      createElement: jest.fn(() => ({ click: clickLink, remove: jest.fn() })),
      body: { appendChild: jest.fn() },
    },
  });
  mockGet.mockResolvedValue({ data: new Blob(['%PDF'], { type: 'application/pdf' }) });
});

it('busca o PDF pelo apiClient como blob e abre numa aba nova', async () => {
  windowOpen.mockReturnValue({});

  await baixarEAbrirReceituario(42, documento);

  expect(mockGet).toHaveBeenCalledWith('/api/v1/eventos-clinicos/42/receituario/7/download', {
    responseType: 'blob',
  });
  expect(windowOpen).toHaveBeenCalledWith('blob:receita', '_blank');
  expect(clickLink).not.toHaveBeenCalled();
  expect(File.downloadFileAsync).not.toHaveBeenCalled();
});

it('com pop-up bloqueado, cai para download direto do arquivo', async () => {
  windowOpen.mockReturnValue(null);

  await baixarEAbrirReceituario(42, documento);

  expect(clickLink).toHaveBeenCalledTimes(1);
});
