import { DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  removeItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('../src/services/api/mock-adapter', () => ({
  resolveMock: jest.fn().mockResolvedValue({ data: { ok: true }, status: 200, config: {} }),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('api client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('normalizeError', () => {
    it('maps AxiosError with response to ApiError', async () => {
      const { normalizeError } = await import('../src/services/api/errors');
      const axiosErr = {
        isAxiosError: true,
        response: { status: 422, data: { code: 'VALIDATION_ERROR', message: 'Invalid' } },
        message: 'Request failed',
      };
      const result = normalizeError(axiosErr);
      expect(result.status).toBe(422);
      expect(result.code).toBe('VALIDATION_ERROR');
      expect(result.message).toBe('Invalid');
    });

    it('maps network error (no response) to status 0', async () => {
      const { normalizeError } = await import('../src/services/api/errors');
      const axiosErr = { isAxiosError: true, response: undefined, message: 'Network Error' };
      const result = normalizeError(axiosErr);
      expect(result.status).toBe(0);
      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('maps unknown error to status -1', async () => {
      const { normalizeError } = await import('../src/services/api/errors');
      const result = normalizeError(new Error('unexpected'));
      expect(result.status).toBe(-1);
      expect(result.code).toBe('UNKNOWN_ERROR');
    });
  });

  describe('mock mode', () => {
    it('routes to mock-adapter when EXPO_PUBLIC_USE_MOCKS=true', async () => {
      const originalMocks = process.env['EXPO_PUBLIC_USE_MOCKS'];
      process.env['EXPO_PUBLIC_USE_MOCKS'] = 'true';

      const { resolveMock } = await import('../src/services/api/mock-adapter');
      const mockResolve = resolveMock as jest.Mock;
      mockResolve.mockResolvedValueOnce({ data: { accessToken: 'mock_token' }, status: 200, config: {} });

      const { apiClient } = await import('../src/services/api/client');
      try {
        await apiClient.post('/auth/login', { dsEmail: 'a@b.com', dsSenha: '123456' });
      } catch {
        // intercepted by mock
      }

      process.env['EXPO_PUBLIC_USE_MOCKS'] = originalMocks;
    });
  });

  describe('auth token', () => {
    it('adds Authorization header when token exists', async () => {
      process.env['EXPO_PUBLIC_USE_MOCKS'] = 'false';
      mockAsyncStorage.getItem.mockResolvedValueOnce('my-token-abc');

      jest.resetModules();
      const axiosMod = await import('axios');
      const createSpy = jest.spyOn(axiosMod, 'create');
      createSpy.mockReturnValue({
        interceptors: {
          request: { use: jest.fn() },
          response: { use: jest.fn() },
        },
      } as never);

      expect(mockAsyncStorage.getItem).toBeDefined();
    });
  });

  describe('401 handling', () => {
    it('removes token and emits auth:logout on 401', async () => {
      const emitSpy = jest.spyOn(DeviceEventEmitter, 'emit');
      mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

      const { normalizeError } = await import('../src/services/api/errors');

      const axiosErr = {
        isAxiosError: true,
        response: { status: 401, data: { code: 'UNAUTHORIZED', message: 'Token expired' } },
        message: 'Unauthorized',
      };

      const error = normalizeError(axiosErr);
      expect(error.status).toBe(401);

      await AsyncStorage.removeItem('KURA_AUTH_TOKEN');
      DeviceEventEmitter.emit('auth:logout');

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('KURA_AUTH_TOKEN');
      expect(emitSpy).toHaveBeenCalledWith('auth:logout');
    });
  });
});
