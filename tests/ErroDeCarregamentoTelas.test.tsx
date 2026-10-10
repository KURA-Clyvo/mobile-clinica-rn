// BR-CLI-T03 fix wave (M-3) — telas de formulário com a busca/lista em ERRO: nunca a frase de
// vazio, sempre o ErrorState com "Tentar de novo" que REFAZ a chamada. Cobre o ramo `compacto`
// do ErrorState (agenda-novo: veterinários) e o bloco centrado (pacientes/novo: busca de tutor),
// que até aqui só tinham print como evidência. O modal "Novo usuário" está em
// UsuariosClinicaScreen.test.tsx.
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import NovoAgendamentoScreen from '../src/app/(app)/agenda-novo';
import NovoPacienteScreen from '../src/app/(app)/pacientes/novo';

const mockListVeterinarios = jest.fn();
jest.mock('@services/veterinarios.service', () => ({
  listVeterinarios: (...args: unknown[]) => mockListVeterinarios(...args),
}));

const mockBuscarTutores = jest.fn();
jest.mock('@services/tutores.service', () => ({
  ...jest.requireActual('@services/tutores.service'),
  buscarTutores: (...args: unknown[]) => mockBuscarTutores(...args),
}));

jest.mock('expo-router', () => {
  const ReactForMock = require('react');
  return {
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: (callback: () => void | (() => void)) => ReactForMock.useEffect(callback, []),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactForMock = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      ReactForMock.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const clientes: QueryClient[] = [];
function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  clientes.push(qc);
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

const originalUseMocks = process.env.EXPO_PUBLIC_USE_MOCKS;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_USE_MOCKS = 'true';
});
afterEach(() => {
  clientes.splice(0).forEach((c) => c.clear());
  process.env.EXPO_PUBLIC_USE_MOCKS = originalUseMocks;
});

describe('agenda-novo — lista de veterinários em erro (ErrorState compacto)', () => {
  it('erro mostra a linha compacta; "Tentar de novo" refaz a chamada e, ao dar certo, mostra os veterinários', async () => {
    mockListVeterinarios
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValue([{ id: 7, nmVeterinario: 'Dra. Teste', nrCRMV: 'SP-7', dsEmail: 'a@b.c' }]);
    const { getByTestId, queryByTestId, findByTestId } = wrap(<NovoAgendamentoScreen />);

    await findByTestId('erro-veterinarios');
    expect(queryByTestId('vet-opcao-7')).toBeNull();
    expect(mockListVeterinarios).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('erro-veterinarios-retry'));

    await waitFor(() => expect(getByTestId('vet-opcao-7')).toBeTruthy());
    expect(mockListVeterinarios).toHaveBeenCalledTimes(2);
    expect(queryByTestId('erro-veterinarios')).toBeNull();
  });
});

describe('pacientes/novo — busca de tutor em erro', () => {
  it('erro mostra o ErrorState e NÃO "Nenhum tutor encontrado"; "Tentar de novo" refaz a busca', async () => {
    mockBuscarTutores.mockRejectedValueOnce(new Error('rede')).mockResolvedValue([]);
    const { getByTestId, queryByTestId, findByTestId } = wrap(<NovoPacienteScreen />);

    fireEvent.changeText(getByTestId('search-tutor-existente'), 'Ana Beatriz');

    await findByTestId('erro-busca-tutor');
    expect(queryByTestId('empty-busca-tutor')).toBeNull();
    expect(mockBuscarTutores).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('erro-busca-tutor-retry'));

    // 2ª chamada deu certo e veio vazia: agora SIM a frase de vazio é verdadeira.
    await waitFor(() => expect(queryByTestId('empty-busca-tutor')).toBeTruthy());
    expect(mockBuscarTutores).toHaveBeenCalledTimes(2);
    expect(queryByTestId('erro-busca-tutor')).toBeNull();
  });
});
