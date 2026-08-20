import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import LoginScreen from '../src/app/login';
import * as authService from '../src/services/auth.service';
import { useAuthStore } from '../src/store/authStore';

const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('@services/auth.service', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  registerClinica: jest.fn(),
}));

const mockLogin = authService.login as jest.Mock;

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>
        {ui}
      </QueryClientProvider>
    </ThemeProvider>
  );
}

const MOCK_USUARIO = {
  id: 1,
  nmVeterinario: 'Dr. Test',
  nrCRMV: '12345-SP',
  dsEmail: 'test@test.com',
};

beforeEach(() => {
  useAuthStore.setState({ token: null, expiresAt: null, usuario: null });
  jest.clearAllMocks();
});

describe('LoginScreen', () => {
  it('renders email and password fields', () => {
    const { getByPlaceholderText } = wrap(<LoginScreen />);
    expect(getByPlaceholderText('seu@email.com')).toBeTruthy();
    expect(getByPlaceholderText('Mínimo 6 caracteres')).toBeTruthy();
  });

  it('renders login button', () => {
    const { getByText } = wrap(<LoginScreen />);
    expect(getByText('Entrar')).toBeTruthy();
  });

  it('shows validation error for invalid email', async () => {
    const { getByPlaceholderText, getByText, findByText } = wrap(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('seu@email.com'), 'not-valid');
    fireEvent.press(getByText('Entrar'));
    await findByText('E-mail inválido');
  });

  it('shows validation error when password is too short', async () => {
    const { getByPlaceholderText, getByText, findByText } = wrap(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('seu@email.com'), 'valid@email.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), '123');
    fireEvent.press(getByText('Entrar'));
    await findByText('A senha deve ter no mínimo 6 caracteres');
  });

  it('calls login service with correct credentials on valid submit', async () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    mockLogin.mockResolvedValue({ accessToken: 'tok', expiresAt: futureDate, usuario: MOCK_USUARIO });

    const { getByPlaceholderText, getByText } = wrap(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('seu@email.com'), 'dr@clinic.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.press(getByText('Entrar'));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ dsEmail: 'dr@clinic.com', dsSenha: 'senha123' });
    });
  });

  it('redirects to dashboard on successful login', async () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    mockLogin.mockResolvedValue({ accessToken: 'tok', expiresAt: futureDate, usuario: MOCK_USUARIO });

    const { getByPlaceholderText, getByText } = wrap(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('seu@email.com'), 'dr@clinic.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.press(getByText('Entrar'));

    await waitFor(() => {
      // URL canônica sem o segmento de grupo `(app)` — CQ-03 (dev VsClaude,
      // KURA_BACKLOG_CLINICA_1). Trava de propósito, não afrouxar.
      expect(mockReplace).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('saves session to store on successful login', async () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    mockLogin.mockResolvedValue({ accessToken: 'tok-abc', expiresAt: futureDate, usuario: MOCK_USUARIO });

    const { getByPlaceholderText, getByText } = wrap(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('seu@email.com'), 'dr@clinic.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.press(getByText('Entrar'));

    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe('tok-abc');
    });
  });

  it('shows invalid credentials chip on 401 error', async () => {
    mockLogin.mockRejectedValue({ status: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' });

    const { getByPlaceholderText, getByText, findByText } = wrap(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('seu@email.com'), 'dr@clinic.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.press(getByText('Entrar'));

    await findByText('E-mail ou senha incorretos');
  });

  it('shows network error chip on non-401 error', async () => {
    mockLogin.mockRejectedValue({ status: 503, code: 'NETWORK', message: 'Network error' });

    const { getByPlaceholderText, getByText, findByText } = wrap(<LoginScreen />);
    fireEvent.changeText(getByPlaceholderText('seu@email.com'), 'dr@clinic.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.press(getByText('Entrar'));

    await findByText('Sem conexão. Verifique sua internet.');
  });
});

// CQ-15 fix wave (G2 vetor F): a G2 provou que a justificativa anterior pra
// NÃO migrar esta tela ("ScreenContainer não expõe maxWidth customizável")
// era falsa por execução, e que a alternativa real não migrada era pior
// (1872px de largura livre num monitor 1920, sem nenhuma restrição) do que
// os 1200px que o backlog original queria evitar. Migrada com a prop
// `maxWidth` explícita nova — mordida: falha contra a tela sem
// ScreenContainer/maxWidth={480}, passa depois da adoção.
describe('LoginScreen — ScreenContainer maxWidth adoption (CQ-15 fix wave)', () => {
  it('constrains the form to maxWidth={480}, not layout.maxContentWidth (1200px)', () => {
    const { getByTestId } = wrap(<LoginScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(480);
  });
});
