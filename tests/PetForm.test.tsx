// REC-04 fix wave (G2, g2-rec04.md) — m-3 (chip de espécie/raça sem teste, mutações
// C/D sobrevivem) e reforço de m-2 no nível de componente (a cadeia REAL de mock, não
// só a função pura já testada em tests/date.test.ts). Cadeia REAL de mock (service ->
// apiClient -> mock-adapter -> pets.mock.ts/tutores.mock.ts), com `jest.spyOn` em
// `apiClient.post` (sem substituir implementação) para inspecionar o CORPO exato
// enviado — mesmo padrão de precisão que as mordidas I-2 desta fix wave.
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import { PetForm } from '../src/components/domain/PetForm';
import { apiClient } from '../src/services/api/client';
import { __resetTutoresParaTeste } from '../src/mocks/tutores.mock';
import type { PetCreateWireDto } from '../src/types/api';

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
// id 900 — "Tutor Já Cadastrado" (CPF_MOCK_DUPLICADO), semeado por padrão no store do
// mock (tutores.mock.ts::buildTutoresArmazenados). Reaproveitado aqui só como um
// idTutor VÁLIDO — nada neste arquivo exercita o CPF em si.
const ID_TUTOR_VALIDO = 900;

beforeEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = 'true';
  __resetTutoresParaTeste();
});

afterEach(() => {
  process.env.EXPO_PUBLIC_USE_MOCKS = originalUseMocks;
  jest.clearAllMocks();
  jest.useRealTimers();
});

function ultimoCorpoDePets(postSpy: jest.SpyInstance): PetCreateWireDto {
  const chamada = postSpy.mock.calls
    .slice()
    .reverse()
    .find(([url]) => url === '/api/v1/pets');
  expect(chamada).toBeDefined();
  return chamada![1] as PetCreateWireDto;
}

describe('PetForm — REC-04 fix wave m-3: espécie/raça enviadas corretamente', () => {
  it('default (sem tocar chip nenhum): idEspecie=1 (Cão), idRaca=1 (Labrador)', async () => {
    const postSpy = jest.spyOn(apiClient, 'post');
    const { getByTestId } = wrap(
      <PetForm idTutor={ID_TUTOR_VALIDO} nomeTutor="Tutor Já Cadastrado" onSuccess={() => {}} />,
    );
    fireEvent.changeText(getByTestId('input-nome-pet'), 'Rex');
    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-pet'));
    });
    await waitFor(() => expect(postSpy).toHaveBeenCalled());

    const corpo = ultimoCorpoDePets(postSpy);
    expect(corpo.idEspecie).toBe(1);
    expect(corpo.idRaca).toBe(1);
  });

  // MORDIDA C (g2-rec04.md M11): trocar espécie E raça precisa refletir EXATAMENTE
  // os ids escolhidos — não os "de fábrica" nem trocados entre si.
  it('MORDIDA C: tocar espécie "Gato" e raça "SRD-felino" envia idEspecie=2, idRaca=4 (não trocados)', async () => {
    const postSpy = jest.spyOn(apiClient, 'post');
    const { getByTestId } = wrap(
      <PetForm idTutor={ID_TUTOR_VALIDO} nomeTutor="Tutor Já Cadastrado" onSuccess={() => {}} />,
    );
    fireEvent.changeText(getByTestId('input-nome-pet'), 'Mimi');
    fireEvent.press(getByTestId('chip-especie-2')); // Gato
    fireEvent.press(getByTestId('chip-raca-4')); // SRD-felino (raça de Gato)
    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-pet'));
    });
    await waitFor(() => expect(postSpy).toHaveBeenCalled());

    const corpo = ultimoCorpoDePets(postSpy);
    expect(corpo.idEspecie).toBe(2);
    expect(corpo.idRaca).toBe(4);
  });

  // MORDIDA D (g2-rec04.md M12): trocar de espécie tem que RESETAR a raça pra uma
  // válida da nova espécie — sem tocar o chip de raça manualmente.
  it('MORDIDA D: trocar só a espécie (sem tocar raça) reseta a raça pra uma válida da nova espécie', async () => {
    const postSpy = jest.spyOn(apiClient, 'post');
    const { getByTestId } = wrap(
      <PetForm idTutor={ID_TUTOR_VALIDO} nomeTutor="Tutor Já Cadastrado" onSuccess={() => {}} />,
    );
    fireEvent.changeText(getByTestId('input-nome-pet'), 'Simba');
    fireEvent.press(getByTestId('chip-especie-2')); // Gato — raça deveria resetar sozinha
    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-pet'));
    });
    await waitFor(() => expect(postSpy).toHaveBeenCalled());

    const corpo = ultimoCorpoDePets(postSpy);
    expect(corpo.idEspecie).toBe(2);
    // Sem o reset (mordida D), idRaca continuaria 1 (Labrador, raça de CÃO) — par
    // inconsistente que o .NET aceita calado (G2 M2) e que só esta guarda evita.
    expect(corpo.idRaca).not.toBe(1);
    expect([3, 4]).toContain(corpo.idRaca); // raças válidas de Gato (Siamês=3, SRD-felino=4)
  });

  it('o seletor de raça só lista raças da espécie selecionada (chip-raca-1/2, de Cão, somem ao trocar pra Gato)', () => {
    const { getByTestId, queryByTestId } = wrap(
      <PetForm idTutor={ID_TUTOR_VALIDO} nomeTutor="Tutor Já Cadastrado" onSuccess={() => {}} />,
    );
    expect(queryByTestId('chip-raca-1')).toBeTruthy(); // Labrador, visível com Cão selecionado
    fireEvent.press(getByTestId('chip-especie-2')); // Gato
    expect(queryByTestId('chip-raca-1')).toBeNull(); // Labrador some
    expect(queryByTestId('chip-raca-3')).toBeTruthy(); // Siamês aparece
  });
});

describe('PetForm — REC-04 fix wave m-2 (reforço, nível de componente): dtNascimento não muda de dia à noite', () => {
  it('cadastro às 22h30 locais envia a data de HOJE, não a de amanhã (sem tocar o date picker)', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2025, 8, 27, 22, 30)); // 27/set/2025, 22:30 local
    const postSpy = jest.spyOn(apiClient, 'post');
    const { getByTestId } = wrap(
      <PetForm idTutor={ID_TUTOR_VALIDO} nomeTutor="Tutor Já Cadastrado" onSuccess={() => {}} />,
    );
    fireEvent.changeText(getByTestId('input-nome-pet'), 'Bidu');
    await act(async () => {
      fireEvent.press(getByTestId('btn-salvar-pet'));
    });
    await waitFor(() => expect(postSpy).toHaveBeenCalled());

    const corpo = ultimoCorpoDePets(postSpy);
    // dtNascimento default = "1 ano atrás de agora" — o DIA precisa ser 27, nunca 28
    // (o que `.toISOString()` produziria nesta máquina, UTC-3 — ver tests/date.test.ts).
    expect(corpo.dtNascimento.startsWith('2024-09-27')).toBe(true);
    expect(corpo.dtNascimento).not.toContain('Z');
    expect(corpo.dtNascimento).not.toContain('09-28');
  });
});
