import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  multiGet: jest.fn().mockResolvedValue([]),
  multiSet: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/queryClient', () => ({
  queryClient: { clear: jest.fn() },
}));

import { useAuthStore } from '../src/store/authStore';
import { queryClient } from '../src/services/queryClient';

const VET = {
  id: 1,
  nmVeterinario: 'Dr. Silva',
  nrCRMV: '12345-SP',
  dsEmail: 'dr@clinic.com',
};

const mockClear = queryClient.clear as jest.Mock;

beforeEach(() => {
  useAuthStore.setState({ token: null, expiresAt: null, usuario: null });
  jest.clearAllMocks();
});

describe('authStore', () => {
  it('initial state has null token, expiresAt and usuario', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.expiresAt).toBeNull();
    expect(state.usuario).toBeNull();
  });

  it('setSession saves token, expiresAt and usuario', () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    useAuthStore.getState().setSession('token-abc', futureDate, VET);
    const state = useAuthStore.getState();
    expect(state.token).toBe('token-abc');
    expect(state.expiresAt).toBe(futureDate);
    expect(state.usuario).toEqual(VET);
  });

  it('isAuthenticated returns true when token exists and expiresAt is in the future', () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    useAuthStore.getState().setSession('valid-token', futureDate, VET);
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });

  it('isAuthenticated returns false when expiresAt is in the past', () => {
    const pastDate = new Date(Date.now() - 1_000).toISOString();
    useAuthStore.getState().setSession('expired-token', pastDate, VET);
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns false when token is null', () => {
    useAuthStore.getState().clearSession();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('clearSession zeroes all auth fields', () => {
    const futureDate = new Date(Date.now() + 9_999).toISOString();
    useAuthStore.getState().setSession('tok', futureDate, VET);
    useAuthStore.getState().clearSession();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.expiresAt).toBeNull();
    expect(state.usuario).toBeNull();
  });

  it('clearSession calls queryClient.clear()', () => {
    useAuthStore.getState().clearSession();
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('isAuthenticated returns false when expiresAt is null', () => {
    useAuthStore.setState({ token: 'orphan', expiresAt: null, usuario: null });
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('token does not appear in console.log during tests', () => {
    const logSpy = jest.spyOn(console, 'log');
    const futureDate = new Date(Date.now() + 9_999).toISOString();
    useAuthStore.getState().setSession('secret-token', futureDate, VET);
    const calls = logSpy.mock.calls.flatMap((args) => args.map(String));
    expect(calls.some((s) => s.includes('secret-token'))).toBe(false);
    logSpy.mockRestore();
  });
});
