import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import RegisterScreen from '../src/app/register';
import LoginScreen from '../src/app/login';
import * as authService from '../src/services/auth.service';
import { useAuthStore } from '../src/store/authStore';

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

jest.mock('@services/auth.service', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  registerClinica: jest.fn(),
}));

const mockRegisterClinica = authService.registerClinica as jest.Mock;
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

const FUTURE_DATE = () => new Date(Date.now() + 3_600_000).toISOString();

const MOCK_REGISTER_RESPONSE = {
  idClinica: 1,
  idVeterinarioAdmin: 2,
  accessToken: 'reg-tok',
  expiresAt: FUTURE_DATE(),
  usuario: {
    id: 2,
    nmVeterinario: 'Dr. Novo Vet',
    nrCRMV: 'SP-99999',
    dsEmail: 'novo@clinic.com',
  },
};

beforeEach(() => {
  useAuthStore.setState({ token: null, expiresAt: null, usuario: null });
  jest.clearAllMocks();
});

describe('RegisterScreen', () => {
  it('renders clinic name and CNPJ fields', () => {
    const { getByPlaceholderText } = wrap(<RegisterScreen />);
    expect(getByPlaceholderText('Ex: Clínica Veterinária Kura')).toBeTruthy();
    expect(getByPlaceholderText('00.000.000/0001-00')).toBeTruthy();
  });

  it('renders vet admin fields', () => {
    const { getByPlaceholderText } = wrap(<RegisterScreen />);
    expect(getByPlaceholderText('Dr(a). Nome Completo')).toBeTruthy();
    expect(getByPlaceholderText('SP-12345')).toBeTruthy();
  });

  it('renders cadastrar button', () => {
    const { getByText } = wrap(<RegisterScreen />);
    expect(getByText('Cadastrar')).toBeTruthy();
  });

  it('shows password mismatch error when passwords differ', async () => {
    const { getByPlaceholderText, getByText, findByText } = wrap(<RegisterScreen />);

    // Fill all required fields
    fireEvent.changeText(getByPlaceholderText('Ex: Clínica Veterinária Kura'), 'Clínica Kura');
    fireEvent.changeText(getByPlaceholderText('00.000.000/0001-00'), '12345678000199');
    fireEvent.changeText(getByPlaceholderText('clinica@email.com'), 'clinica@email.com');
    fireEvent.changeText(getByPlaceholderText('(11) 99999-9999'), '11987654321');
    fireEvent.changeText(getByPlaceholderText('Rua, número, bairro, cidade'), 'Rua das Flores, 123');
    fireEvent.changeText(getByPlaceholderText('Dr(a). Nome Completo'), 'Dr. João Silva');
    fireEvent.changeText(getByPlaceholderText('SP-12345'), 'SP-54321');
    fireEvent.changeText(getByPlaceholderText('vet@email.com'), 'joao@vet.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.changeText(getByPlaceholderText('Repita a senha'), 'senhadiferente');

    fireEvent.press(getByText('Cadastrar'));
    await findByText('As senhas não coincidem');
  });

  it('calls registerClinica with correct data on valid submit', async () => {
    mockRegisterClinica.mockResolvedValue(MOCK_REGISTER_RESPONSE);

    const { getByPlaceholderText, getByText } = wrap(<RegisterScreen />);

    fireEvent.changeText(getByPlaceholderText('Ex: Clínica Veterinária Kura'), 'Clínica Kura');
    fireEvent.changeText(getByPlaceholderText('00.000.000/0001-00'), '12345678000199');
    fireEvent.changeText(getByPlaceholderText('clinica@email.com'), 'clinica@email.com');
    fireEvent.changeText(getByPlaceholderText('(11) 99999-9999'), '11987654321');
    fireEvent.changeText(getByPlaceholderText('Rua, número, bairro, cidade'), 'Rua das Flores, 123');
    fireEvent.changeText(getByPlaceholderText('Dr(a). Nome Completo'), 'Dr. João Silva');
    fireEvent.changeText(getByPlaceholderText('SP-12345'), 'SP-54321');
    fireEvent.changeText(getByPlaceholderText('vet@email.com'), 'joao@vet.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.changeText(getByPlaceholderText('Repita a senha'), 'senha123');

    fireEvent.press(getByText('Cadastrar'));

    await waitFor(() => {
      expect(mockRegisterClinica).toHaveBeenCalledWith(
        expect.objectContaining({
          nmClinica: 'Clínica Kura',
          dsEmailAdmin: 'joao@vet.com',
          dsSenhaAdmin: 'senha123',
        }),
      );
    });
  });

  it('does not include confirmSenha in the registerClinica call', async () => {
    mockRegisterClinica.mockResolvedValue(MOCK_REGISTER_RESPONSE);

    const { getByPlaceholderText, getByText } = wrap(<RegisterScreen />);

    fireEvent.changeText(getByPlaceholderText('Ex: Clínica Veterinária Kura'), 'Clínica Kura');
    fireEvent.changeText(getByPlaceholderText('00.000.000/0001-00'), '12345678000199');
    fireEvent.changeText(getByPlaceholderText('clinica@email.com'), 'clinica@email.com');
    fireEvent.changeText(getByPlaceholderText('(11) 99999-9999'), '11987654321');
    fireEvent.changeText(getByPlaceholderText('Rua, número, bairro, cidade'), 'Rua das Flores, 123');
    fireEvent.changeText(getByPlaceholderText('Dr(a). Nome Completo'), 'Dr. João Silva');
    fireEvent.changeText(getByPlaceholderText('SP-12345'), 'SP-54321');
    fireEvent.changeText(getByPlaceholderText('vet@email.com'), 'joao@vet.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.changeText(getByPlaceholderText('Repita a senha'), 'senha123');

    fireEvent.press(getByText('Cadastrar'));

    await waitFor(() => {
      const callArg = mockRegisterClinica.mock.calls[0]?.[0];
      expect(callArg).not.toHaveProperty('confirmSenha');
    });
  });

  it('redirects to dashboard after successful registration', async () => {
    mockRegisterClinica.mockResolvedValue(MOCK_REGISTER_RESPONSE);

    const { getByPlaceholderText, getByText } = wrap(<RegisterScreen />);

    fireEvent.changeText(getByPlaceholderText('Ex: Clínica Veterinária Kura'), 'Clínica Kura');
    fireEvent.changeText(getByPlaceholderText('00.000.000/0001-00'), '12345678000199');
    fireEvent.changeText(getByPlaceholderText('clinica@email.com'), 'clinica@email.com');
    fireEvent.changeText(getByPlaceholderText('(11) 99999-9999'), '11987654321');
    fireEvent.changeText(getByPlaceholderText('Rua, número, bairro, cidade'), 'Rua das Flores, 123');
    fireEvent.changeText(getByPlaceholderText('Dr(a). Nome Completo'), 'Dr. João Silva');
    fireEvent.changeText(getByPlaceholderText('SP-12345'), 'SP-54321');
    fireEvent.changeText(getByPlaceholderText('vet@email.com'), 'joao@vet.com');
    fireEvent.changeText(getByPlaceholderText('Mínimo 6 caracteres'), 'senha123');
    fireEvent.changeText(getByPlaceholderText('Repita a senha'), 'senha123');

    fireEvent.press(getByText('Cadastrar'));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(app)/dashboard');
    });
  });
});

describe('LoginScreen register link', () => {
  it('renders "Cadastrar clínica" link', () => {
    const { getByText } = wrap(<LoginScreen />);
    expect(getByText('Cadastrar clínica')).toBeTruthy();
  });

  it('navigates to register screen when link is pressed', () => {
    mockLogin.mockResolvedValue({
      accessToken: 'tok',
      expiresAt: FUTURE_DATE(),
      usuario: { id: 1, nmVeterinario: 'Dr. Test', nrCRMV: '12345', dsEmail: 'test@test.com' },
    });

    const { getByTestId } = wrap(<LoginScreen />);
    fireEvent.press(getByTestId('login-register-link'));
    expect(mockPush).toHaveBeenCalledWith('/register');
  });
});
