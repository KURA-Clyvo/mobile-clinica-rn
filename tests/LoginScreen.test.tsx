import React from 'react';
import { render, fireEvent, waitFor, within } from '@testing-library/react-native';
import { StyleSheet, ScrollView } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, lightColors } from '../src/theme';
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

// CQ-15 fix wave rodada 3 (G2 rodada 2, Important #1): a G2 reproduziu que a
// migração pra ScreenContainer tinha perdido `keyboardShouldPersistTaps=
// "handled"` — com o teclado aberto, o primeiro toque em "Entrar" era
// engolido pelo dismiss do teclado em vez de chegar ao botão. Mordida:
// falha se a prop sumir de login.tsx ou do repasse em ScreenContainer.tsx.
describe('LoginScreen — keyboardShouldPersistTaps (CQ-15 fix wave rodada 3)', () => {
  it('passes keyboardShouldPersistTaps="handled" to the inner ScrollView', () => {
    const { UNSAFE_getByType } = wrap(<LoginScreen />);
    expect(UNSAFE_getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });
});

// Fix wave da CQ-12 (dev VsClaude, KURA_BACKLOG_CLINICA_1), item 2: login é a
// primeira tela que qualquer pessoa vê, e ficou sem marca quando a CQ-12
// trocou o KCIcon "paw" do NavDrawer pelo KuraMark — só o drawer ganhou a
// marca canônica. Mesmo padrão de prova do NavDrawer.test.tsx: identifica o
// KuraMark pelo `aria-label="Kura mark"` (único entre os SVGs da tela) e
// prova a cor por mutação — trocar `colors.primary` por
// `colors.textOnPrimary` aqui faria a marca ficar quase invisível sobre o
// fundo claro do ScreenContainer (ruling D-3), e TEM que deixar a asserção
// de cor vermelha.
describe('LoginScreen — marca canônica na tela de entrada (CQ-12 fix wave)', () => {
  it('renderiza o KuraMark (aria-label "Kura mark") acima do nome do app', () => {
    const { getAllByTestId } = wrap(<LoginScreen />);
    const svgs = getAllByTestId('Svg');
    const mark = svgs.find((svg) => svg.props['aria-label'] === 'Kura mark');
    expect(mark).toBeDefined();
  });

  it('usa colors.primary (superfície clara), não colors.textOnPrimary (knockout)', () => {
    const { getAllByTestId } = wrap(<LoginScreen />);
    const svgs = getAllByTestId('Svg');
    const mark = svgs.find((svg) => svg.props['aria-label'] === 'Kura mark');
    if (!mark) throw new Error('KuraMark não encontrado na tela de login');

    // Pré-condição da mordida: os dois tokens têm que divergir no tema
    // claro, senão trocar um pelo outro não faria nenhuma asserção falhar.
    expect(lightColors.primary).not.toBe(lightColors.textOnPrimary);
    const circles = within(mark).getAllByTestId('Circle');
    expect(circles).toHaveLength(3);
    circles.forEach((circle) => {
      // Mutação: mudar o `color` passado ao KuraMark em login.tsx de
      // `colors.primary` para `colors.textOnPrimary` faz esta linha falhar
      // — é exatamente o erro que deixaria a marca quase invisível na
      // demo, sobre o fundo claro do ScreenContainer.
      expect(circle.props.fill).toBe(lightColors.primary);
    });
  });
});
