// REC-04 — "Adicionar pet a partir de um tutor existente" (pacientes/novo.tsx).
// Cadeia REAL de mock (service -> apiClient -> mock-adapter ->
// tutores.mock.ts/pets.mock.ts), mesmo padrão de NovoTutorScreen.test.tsx.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import NovoPacienteScreen from '../src/app/(app)/pacientes/novo';
import { __resetTutoresParaTeste } from '../src/mocks/tutores.mock';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const ReactForMock = require('react');
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
    // Mesmo raciocínio de NovoTutorScreen.test.tsx: tela renderizada isolada,
    // sem navegação real — useEffect(callback, []) emula um ciclo de foco.
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

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

const originalUseMocks = process.env.EXPO_PUBLIC_USE_MOCKS;

beforeEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = 'true';
  __resetTutoresParaTeste();
});

afterEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = originalUseMocks;
  jest.clearAllMocks();
});

describe('NovoPacienteScreen — busca de tutor existente', () => {
  it('busca por nome encontra o tutor pré-semeado do mock (CPF_MOCK_DUPLICADO)', async () => {
    const { getByTestId, queryByText } = wrap(<NovoPacienteScreen />);

    fireEvent.changeText(getByTestId('search-tutor-existente'), 'Já Cadastrado');

    await waitFor(() => expect(queryByText('Tutor Já Cadastrado')).toBeTruthy());
  });

  it('menos de 2 caracteres não dispara busca nenhuma (mostra a dica, não a lista vazia)', async () => {
    const { getByTestId, queryByTestId, queryByText } = wrap(<NovoPacienteScreen />);

    fireEvent.changeText(getByTestId('search-tutor-existente'), 'a');

    expect(queryByText('Digite ao menos 2 caracteres para buscar.')).toBeTruthy();
    expect(queryByTestId('empty-busca-tutor')).toBeNull();
  });

  it('busca sem match nenhum mostra o estado vazio, não lança', async () => {
    const { getByTestId, queryByTestId } = wrap(<NovoPacienteScreen />);

    fireEvent.changeText(getByTestId('search-tutor-existente'), 'zzz-nao-existe');

    await waitFor(() => expect(queryByTestId('empty-busca-tutor')).toBeTruthy());
  });

  it('selecionar um tutor mostra o formulário de pet (PetForm), pré-nomeado com o tutor', async () => {
    const { getByTestId, findByTestId, queryByText } = wrap(<NovoPacienteScreen />);

    fireEvent.changeText(getByTestId('search-tutor-existente'), 'Já Cadastrado');
    const item = await findByTestId(/^tutor-item-\d+$/);
    fireEvent.press(item);

    await waitFor(() => expect(getByTestId('input-nome-pet')).toBeTruthy());
    expect(queryByText('Pet de Tutor Já Cadastrado')).toBeTruthy();
  });
});

describe('NovoPacienteScreen — cadastro de pet para tutor existente (encadeamento, sem convite)', () => {
  it('salva o pet e mostra a tela de sucesso, SEM convite nenhum (tutor já tem conta)', async () => {
    const { getByTestId, findByTestId, queryByTestId } = wrap(<NovoPacienteScreen />);

    fireEvent.changeText(getByTestId('search-tutor-existente'), 'Já Cadastrado');
    const item = await findByTestId(/^tutor-item-\d+$/);
    fireEvent.press(item);

    await waitFor(() => expect(getByTestId('input-nome-pet')).toBeTruthy());
    fireEvent.changeText(getByTestId('input-nome-pet'), 'Bidu');
    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-pet'));
    });

    await waitFor(() => expect(queryByTestId('btn-voltar-pet-salvo')).toBeTruthy());
    expect(queryByTestId('convite-qrcode')).toBeNull();
  });

  it('"Voltar" da etapa de formulário retorna à busca (sem perder o estado da lista)', async () => {
    const { getByTestId, findByTestId } = wrap(<NovoPacienteScreen />);

    fireEvent.changeText(getByTestId('search-tutor-existente'), 'Já Cadastrado');
    const item = await findByTestId(/^tutor-item-\d+$/);
    fireEvent.press(item);
    await waitFor(() => expect(getByTestId('input-nome-pet')).toBeTruthy());

    fireEvent.press(getByTestId('btn-voltar-selecao-tutor'));

    await waitFor(() => expect(getByTestId('search-tutor-existente')).toBeTruthy());
  });
});
