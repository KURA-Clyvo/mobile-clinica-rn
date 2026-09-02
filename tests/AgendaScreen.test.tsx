import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../src/theme';
import AgendaScreen from '../src/app/(app)/agenda';
import { getMondayOf, addDays } from '../src/utils/date';
import { layout } from '../src/theme/tokens';

const mockAtualizarStatusMutate = jest.fn();
jest.mock('@hooks/useAgenda', () => ({
  useAgendaSemana: jest.fn(),
  // FM-04: AgendamentoStatusMenu (agora sempre montado dentro de
  // AgendaScreen, ainda que com visible=false) chama este hook — sem
  // mocká-lo aqui, useMutation do @tanstack/react-query quebraria por
  // falta de QueryClientProvider no wrap() deste arquivo.
  useAtualizarStatusAgendamento: jest.fn(),
}));

// FM-04: AgendamentoStatusMenu usa useSafeAreaInsets — sem provider neste
// wrap(), o hook lança "No safe area value available". ScreenContainer usa
// <SafeAreaView> do MESMO módulo, então o mock precisa preservar esse
// export também (mesmo padrão de tests/ConsultaScreen.test.tsx).
jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      ReactLocal.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// CQ-15: useWindowDimensions é o que useBreakpoint()/ScreenContainer consomem
// (nunca Dimensions.get(), que não re-renderiza em resize de janela na web).
const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

function setViewport(width: number, height: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

import { useAgendaSemana, useAtualizarStatusAgendamento } from '../src/hooks/useAgenda';
const mockUseAgendaSemana = useAgendaSemana as jest.Mock;
const mockUseAtualizarStatusAgendamento = useAtualizarStatusAgendamento as jest.Mock;

const REFETCH = jest.fn().mockResolvedValue(undefined);

const TODAY_9AM = (() => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
})();

const TOMORROW_10AM = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
})();

const MOCK_APPOINTMENT_TODAY = {
  id: 1,
  dtInicio: TODAY_9AM.toISOString(),
  nrDuracaoMinutos: 30,
  sgStatus: 'AGENDADA' as const,
  // FM-04: campos novos e obrigatórios de AgendamentoResponse.
  dsStatusOrigem: 'AGENDADO',
  nrVersion: 1,
  pet: { id: 1, nmPet: 'Thor', nmEspecie: 'Cão', nmRaca: 'Labrador' },
  tutor: { id: 1, nmTutor: 'Carlos Mendes', dsTelefone: '11987654321' },
  veterinario: { id: 1, nmVeterinario: 'Dr. Felipe Ferrete', nrCRMV: 'SP-12345' },
};

const MOCK_APPOINTMENT_TOMORROW = {
  id: 2,
  dtInicio: TOMORROW_10AM.toISOString(),
  nrDuracaoMinutos: 45,
  sgStatus: 'AGENDADA' as const,
  dsStatusOrigem: 'AGENDADO',
  nrVersion: 1,
  pet: { id: 2, nmPet: 'Mel', nmEspecie: 'Cão', nmRaca: 'Poodle' },
  tutor: { id: 2, nmTutor: 'Patrícia Souza', dsTelefone: '11976543210' },
  veterinario: { id: 1, nmVeterinario: 'Dr. Felipe Ferrete', nrCRMV: 'SP-12345' },
};

function makeDefaultHookReturn(data: unknown[], isLoading = false) {
  const semanaStart = getMondayOf(new Date());
  const semanaEnd = addDays(semanaStart, 6);
  return {
    data,
    isLoading,
    isError: false,
    refetch: REFETCH,
    semanaStart,
    semanaEnd,
  };
}

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  REFETCH.mockResolvedValue(undefined);
  setViewport(400, 800);
  mockUseAtualizarStatusAgendamento.mockReturnValue({
    mutate: mockAtualizarStatusMutate,
    isPending: false,
    variables: undefined,
  });
});

describe('AgendaScreen — loading state', () => {
  it('shows skeleton placeholders while loading', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([], true));
    const { getAllByTestId } = wrap(<AgendaScreen />);
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });
});

describe('AgendaScreen — loaded state', () => {
  it('shows appointments for selected day (today)', () => {
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([MOCK_APPOINTMENT_TODAY, MOCK_APPOINTMENT_TOMORROW]),
    );
    const { getByText } = wrap(<AgendaScreen />);
    expect(getByText('Thor')).toBeTruthy();
  });

  it('does not show appointments from other days on today tab', () => {
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([MOCK_APPOINTMENT_TODAY, MOCK_APPOINTMENT_TOMORROW]),
    );
    const { queryByText } = wrap(<AgendaScreen />);
    // Mel is tomorrow — not shown on today's tab
    expect(queryByText('Mel')).toBeNull();
  });

  it('shows week range in header', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByTestId } = wrap(<AgendaScreen />);
    expect(getByTestId('week-range')).toBeTruthy();
    expect(getByTestId('week-range').props.children).toBeTruthy();
  });

  it('renders 7 day tabs', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getAllByTestId } = wrap(<AgendaScreen />);
    const tabs = [];
    for (let i = 0; i < 7; i++) {
      const tab = getAllByTestId(`day-tab-${i}`);
      if (tab.length > 0) tabs.push(tab[0]);
    }
    expect(tabs).toHaveLength(7);
  });

  it('shows appointment details: pet species, tutor name', () => {
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([MOCK_APPOINTMENT_TODAY]),
    );
    const { getByText } = wrap(<AgendaScreen />);
    expect(getByText(/Carlos Mendes/)).toBeTruthy();
    expect(getByText(/Cão/)).toBeTruthy();
  });
});

// FM-04 — Ruling D-13: a ação de status mora no card da agenda. Estes testes
// provam o ponto de entrada (o botão "Status" aparece só quando há transição
// disponível) e a distinção visual do achado nº 2 (NAO_COMPARECEU != Cancelada).
describe('AgendaScreen — status action entry point (FM-04)', () => {
  it('shows the "Status" button for an AGENDADO appointment (has transitions)', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([MOCK_APPOINTMENT_TODAY]));
    const { getByTestId } = wrap(<AgendaScreen />);
    expect(getByTestId('btn-status-menu-1')).toBeTruthy();
  });

  it('hides the "Status" button for a REALIZADO appointment (terminal, no transitions)', () => {
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([
        { ...MOCK_APPOINTMENT_TODAY, sgStatus: 'CONCLUIDA' as const, dsStatusOrigem: 'REALIZADO' },
      ]),
    );
    const { queryByTestId } = wrap(<AgendaScreen />);
    expect(queryByTestId('btn-status-menu-1')).toBeNull();
  });

  it('hides the "Status" button for a CANCELADO appointment (terminal, no transitions)', () => {
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([
        { ...MOCK_APPOINTMENT_TODAY, sgStatus: 'CANCELADA' as const, dsStatusOrigem: 'CANCELADO' },
      ]),
    );
    const { queryByTestId } = wrap(<AgendaScreen />);
    expect(queryByTestId('btn-status-menu-1')).toBeNull();
  });

  it('tapping "Status" opens the menu for that specific appointment (pet name shown)', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([MOCK_APPOINTMENT_TODAY]));
    const { getByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-status-menu-1'));
    expect(getByTestId('status-menu-pet-name').props.children).toBe('Thor');
    // AGENDADO -> os 4 destinos, incluindo CONFIRMADO.
    expect(getByTestId('btn-status-CONFIRMADO')).toBeTruthy();
  });

  // FM-04, achado nº 2 do brief: antes desta task, NAO_COMPARECEU e
  // CANCELADA renderizavam com o MESMO rótulo ("Cancelada") — um "faltou"
  // era indistinguível de um cancelamento de verdade. Prova de mordida:
  // rodar este teste contra a STATUS_TRANSLATION_TABLE antiga (agenda.
  // service.ts, antes do fix) faz `getByText('Não compareceu')` lançar
  // (o texto nunca existiria — tudo virava 'Cancelada').
  it('renders a distinct label for NAO_COMPARECEU (not "Cancelada")', () => {
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([
        {
          ...MOCK_APPOINTMENT_TODAY,
          sgStatus: 'NAO_COMPARECEU' as const,
          dsStatusOrigem: 'NAO_COMPARECEU',
        },
      ]),
    );
    const { getByText, queryByText } = wrap(<AgendaScreen />);
    expect(getByText('Não compareceu')).toBeTruthy();
    expect(queryByText('Cancelada')).toBeNull();
  });

  it('renders "Confirmada" (not "Em andamento") for a CONFIRMADO appointment', () => {
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([
        { ...MOCK_APPOINTMENT_TODAY, sgStatus: 'CONFIRMADA' as const, dsStatusOrigem: 'CONFIRMADO' },
      ]),
    );
    const { getByText, queryByText } = wrap(<AgendaScreen />);
    expect(getByText('Confirmada')).toBeTruthy();
    expect(queryByText('Em andamento')).toBeNull();
  });
});

describe('AgendaScreen — empty state', () => {
  it('shows empty state when no appointments for selected day', () => {
    // Only tomorrow's appointment — today should show empty state
    mockUseAgendaSemana.mockReturnValue(
      makeDefaultHookReturn([MOCK_APPOINTMENT_TOMORROW]),
    );
    const { getByTestId } = wrap(<AgendaScreen />);
    expect(getByTestId('empty-agenda')).toBeTruthy();
  });

  it('empty state text is correct', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByText } = wrap(<AgendaScreen />);
    expect(getByText('Nenhuma consulta neste dia')).toBeTruthy();
  });

  // CQ-13 (item 1) — `empty-agenda` passou a usar `KCEmptyState`: título
  // (verificado acima, sem regressão) E descrição instrutiva nova.
  it('empty state shows instructive description too', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByText } = wrap(<AgendaScreen />);
    expect(
      getByText('Toque em outro dia da semana ou aguarde novos agendamentos.'),
    ).toBeTruthy();
  });
});

describe('AgendaScreen — week navigation', () => {
  it('renders prev and next week buttons', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByTestId } = wrap(<AgendaScreen />);
    expect(getByTestId('btn-prev-week')).toBeTruthy();
    expect(getByTestId('btn-next-week')).toBeTruthy();
  });

  it('pressing next week triggers hook with next week base', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-next-week'));
    // Hook is called again with a new semanaBase
    expect(mockUseAgendaSemana).toHaveBeenCalledTimes(2);
  });

  it('pressing prev week triggers hook with prev week base', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-prev-week'));
    expect(mockUseAgendaSemana).toHaveBeenCalledTimes(2);
  });
});

// CQ-15: prova de mordida — falha contra a tela sem ScreenContainer (o
// testID/estilo 'screen-container-content' não existe hoje), passa depois da
// adoção. Segue o mesmo padrão de asserção de ScreenContainer.test.tsx: não
// mede px calculado (o react-test-renderer não computa layout Yoga), só o
// estilo declarado.
describe('AgendaScreen — ScreenContainer adoption (CQ-15)', () => {
  it('respects layout.maxContentWidth at 1440×900 (xl)', () => {
    setViewport(1440, 900);
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByTestId } = wrap(<AgendaScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { maxWidth?: number };
    expect(flatStyle.maxWidth).toBe(layout.maxContentWidth);
  });

  // CQ-15 fix wave rodada 3 (G2 rodada 2, Minor #3): a G2 reproduziu que
  // remover `paddingHorizontal={0}` deixava a suíte inteira verde — a tela
  // já controla o próprio respiro (listContent: padding:16), e um respiro
  // do container por cima duplicaria a margem lateral.
  it('applies paddingHorizontal:0 (the screen controls its own horizontal padding)', () => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
    const { getByTestId } = wrap(<AgendaScreen />);
    const inner = getByTestId('screen-container-content');
    const flatStyle = StyleSheet.flatten(inner.props.style) as { paddingHorizontal?: number };
    expect(flatStyle.paddingHorizontal).toBe(0);
  });
});
