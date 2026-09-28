// REC-04 — "Adicionar pet a partir de um tutor existente" (pacientes/novo.tsx).
// Cadeia REAL de mock (service -> apiClient -> mock-adapter ->
// tutores.mock.ts/pets.mock.ts), mesmo padrão de NovoTutorScreen.test.tsx.
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import NovoPacienteScreen from '../src/app/(app)/pacientes/novo';
import { __resetTutoresParaTeste } from '../src/mocks/tutores.mock';
import { apiClient } from '../src/services/api/client';

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

describe('NovoPacienteScreen — cadastro de pet para tutor existente (encadeamento)', () => {
  it('salva o pet e mostra a tela de sucesso — o convite NÃO aparece sozinho (só se "Gerar convite" for acionado)', async () => {
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
    // REC-04 fix wave (G2, I-1b): o botão "Gerar convite" existe — antes desta
    // correção não havia NENHUM jeito de convidar um tutor achado por aqui.
    expect(getByTestId('btn-gerar-convite')).toBeTruthy();
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

// REC-04 fix wave (G2, I-1b): "Gerar convite" a partir de um tutor existente
// (POST /tutores/{id}/convite, REC-02) — a única forma de convidar um tutor
// achado por "+ Novo" antes desta correção era NENHUMA.
describe('NovoPacienteScreen — REC-04 fix wave I-1b: "Gerar convite" (201 mostra QR, 409 avisa "já tem conta")', () => {
  async function salvarPetParaTutor(nomeBusca: string) {
    const { getByTestId, findByTestId, queryByTestId } = wrap(<NovoPacienteScreen />);
    fireEvent.changeText(getByTestId('search-tutor-existente'), nomeBusca);
    const item = await findByTestId(/^tutor-item-\d+$/);
    fireEvent.press(item);
    await waitFor(() => expect(getByTestId('input-nome-pet')).toBeTruthy());
    fireEvent.changeText(getByTestId('input-nome-pet'), 'Bidu');
    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-pet'));
    });
    await waitFor(() => expect(getByTestId('btn-gerar-convite')).toBeTruthy());
    return { getByTestId, queryByTestId };
  }

  it('201 — mostra o convite (QR/WhatsApp/copiar link), reaproveitando a mesma tela da REC-03', async () => {
    const { getByTestId, queryByTestId } = await salvarPetParaTutor('Já Cadastrado');

    await act(async () => {
      fireEvent.press(getByTestId('btn-gerar-convite'));
    });

    await waitFor(() => expect(getByTestId('convite-qrcode')).toBeTruthy());
    expect(queryByTestId('sem-conta-aviso')).toBeNull();
  });

  it('409 — tutor JÁ tem conta: mostra o aviso certo, SEM Alert e SEM convite', async () => {
    const { getByTestId, queryByTestId } = await salvarPetParaTutor('Com Conta Ativa');
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await act(async () => {
      fireEvent.press(getByTestId('btn-gerar-convite'));
    });

    await waitFor(() => expect(getByTestId('sem-conta-aviso')).toBeTruthy());
    expect(queryByTestId('convite-qrcode')).toBeNull();
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

// REC-04 fix wave (G2, I-2): mordida B do revisor (g2-rec04.md M10) — trocar
// o `idTutor` passado ao `PetForm` por OUTRO tutor válido (900) sobrevivia à
// suíte inteira. Usa o tutor 901 (distinto de 900) para que a troca não
// passe por acaso — se o código regredisse pro id fixo/errado, este teste
// pegaria mesmo que 900 "parecesse" certo por coincidência.
describe('NovoPacienteScreen — REC-04 fix wave I-2: o pet vai para o tutor TOCADO na busca, não outro', () => {
  it('POST /pets sai com idTutor === id do item tocado (901, "Tutor Com Conta Ativa")', async () => {
    const postSpy = jest.spyOn(apiClient, 'post');
    const { getByTestId, findByTestId } = wrap(<NovoPacienteScreen />);

    fireEvent.changeText(getByTestId('search-tutor-existente'), 'Com Conta Ativa');
    const item = await findByTestId(/^tutor-item-\d+$/);
    const idTocado = Number(String(item.props.testID).replace('tutor-item-', ''));
    expect(idTocado).toBe(901);
    fireEvent.press(item);

    await waitFor(() => expect(getByTestId('input-nome-pet')).toBeTruthy());
    fireEvent.changeText(getByTestId('input-nome-pet'), 'Bidu');
    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-pet'));
    });

    await waitFor(() => expect(postSpy).toHaveBeenCalled());
    const chamadaPet = postSpy.mock.calls.find(([url]) => url === '/api/v1/pets');
    expect(chamadaPet).toBeDefined();
    const corpo = chamadaPet![1] as { idTutor: number };
    expect(corpo.idTutor).toBe(901);
  });
});
