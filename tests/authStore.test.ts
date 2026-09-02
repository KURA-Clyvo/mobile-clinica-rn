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

// FM-01 — `setSession` passou de 3 argumentos posicionais para um objeto de
// parametros, porque o store deixou de ter UM conceito (`usuario`) e passou a
// ter DOIS: quem sou (`email` + `tpPerfil`, sempre presentes pos-login) e
// minha ficha de veterinario (`usuario`, opcional). Posicional com 5 campos,
// dois deles anulaveis, e convite a troca silenciosa de argumento.
function sessao(over: Partial<Parameters<ReturnType<typeof useAuthStore.getState>['setSession']>[0]> = {}) {
  return {
    token: 'token-abc',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'dr@clinic.com',
    tpPerfil: 'VETERINARIO' as const,
    usuario: VET,
    ...over,
  };
}

beforeEach(() => {
  useAuthStore.setState({
    token: null,
    expiresAt: null,
    email: null,
    tpPerfil: null,
    usuario: null,
  });
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
    useAuthStore.getState().setSession(sessao({ expiresAt: futureDate }));
    const state = useAuthStore.getState();
    expect(state.token).toBe('token-abc');
    expect(state.expiresAt).toBe(futureDate);
    expect(state.usuario).toEqual(VET);
  });

  it('isAuthenticated returns true when token exists and expiresAt is in the future', () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    useAuthStore.getState().setSession(sessao({ token: 'valid-token', expiresAt: futureDate }));
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });

  it('isAuthenticated returns false when expiresAt is in the past', () => {
    const pastDate = new Date(Date.now() - 1_000).toISOString();
    useAuthStore.getState().setSession(sessao({ token: 'expired-token', expiresAt: pastDate }));
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns false when token is null', () => {
    useAuthStore.getState().clearSession();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  // ─── FM-01: identidade sem ficha de veterinario ──────────────────────
  //
  // O caso central da task, e o que NAO se prova rodando o app: o login de
  // demonstracao sempre traz `usuario` preenchido (RegisterClinicaAsync cria
  // o gestor COM vinculo), entao este estado so existe se for construido.
  it('GESTOR sem ficha: identidade sobrevive, a sessao vale, e `usuario` fica null', () => {
    useAuthStore.getState().setSession(
      sessao({ email: 'gestor@clinica.com', tpPerfil: 'GESTOR', usuario: null }),
    );
    const state = useAuthStore.getState();

    // A ficha nao existe -- e isso e legitimo, nao erro.
    expect(state.usuario).toBeNull();
    // Mas "quem sou" continua inteiro: e disso que as telas dependem agora.
    expect(state.email).toBe('gestor@clinica.com');
    expect(state.tpPerfil).toBe('GESTOR');
    // E a sessao e valida: ficha ausente nao e sessao invalida.
    expect(state.isAuthenticated()).toBe(true);
  });

  it('setSession guarda email e tpPerfil junto do token', () => {
    useAuthStore.getState().setSession(sessao({ email: 'vet@clinica.com', tpPerfil: 'VETERINARIO' }));
    const state = useAuthStore.getState();
    expect(state.email).toBe('vet@clinica.com');
    expect(state.tpPerfil).toBe('VETERINARIO');
  });

  it('clearSession zeroes all auth fields', () => {
    const futureDate = new Date(Date.now() + 9_999).toISOString();
    useAuthStore.getState().setSession(sessao({ token: 'tok', expiresAt: futureDate }));
    useAuthStore.getState().clearSession();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.expiresAt).toBeNull();
    expect(state.usuario).toBeNull();
    // FM-01: os 2 campos novos entram AQUI de proposito. Um `clearSession`
    // que esquecesse `email`/`tpPerfil` deixaria a identidade do usuario
    // anterior visivel no NavDrawer depois do logout -- vazamento entre
    // sessoes na mesma instalacao, e o tipo de coisa que so aparece quando
    // duas pessoas usam o mesmo aparelho.
    expect(state.email).toBeNull();
    expect(state.tpPerfil).toBeNull();
  });

  it('clearSession calls queryClient.clear()', () => {
    useAuthStore.getState().clearSession();
    expect(mockClear).toHaveBeenCalledTimes(1);
  });

  it('isAuthenticated returns false when expiresAt is null', () => {
    useAuthStore.setState({ token: 'orphan', expiresAt: null, email: null, tpPerfil: null, usuario: null });
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);
  });

  it('token does not appear in console.log during tests', () => {
    const logSpy = jest.spyOn(console, 'log');
    const futureDate = new Date(Date.now() + 9_999).toISOString();
    useAuthStore.getState().setSession(sessao({ token: 'secret-token', expiresAt: futureDate }));
    const calls = logSpy.mock.calls.flatMap((args) => args.map(String));
    expect(calls.some((s) => s.includes('secret-token'))).toBe(false);
    logSpy.mockRestore();
  });
});
