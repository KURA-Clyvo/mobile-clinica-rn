import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from '../src/theme';
import AgendaScreen from '../src/app/(app)/agenda';
import { getMondayOf, addDays } from '../src/utils/date';
import { layout } from '../src/theme/tokens';

const mockAtualizarStatusMutate = jest.fn();
// REC-12: useAgendaHoje/useCheckinAgendamento são chamados INCONDICIONALMENTE
// por AgendaScreen (regra dos hooks), mesmo quando o modo default 'semana'
// está ativo — sem mocká-los aqui, `undefined()` derruba todo render desta
// suíte (mesmo padrão já documentado para useAtualizarStatusAgendamento).
const mockCheckinMutate = jest.fn();
jest.mock('@hooks/useAgenda', () => ({
  useAgendaSemana: jest.fn(),
  // FM-04: AgendamentoStatusMenu (agora sempre montado dentro de
  // AgendaScreen, ainda que com visible=false) chama este hook — sem
  // mocká-lo aqui, useMutation do @tanstack/react-query quebraria por
  // falta de QueryClientProvider no wrap() deste arquivo.
  useAtualizarStatusAgendamento: jest.fn(),
  useAgendaHoje: jest.fn(),
  useCheckinAgendamento: jest.fn(),
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
// Fix wave G2 (I-1) — `useFocusEffect` real (react-navigation) roda a função
// no foco e a limpeza no blur; este mock roda a função uma vez no mount (via
// `useEffect(callback, [])`, mesmo padrão já usado em
// `tests/touchTargetRegistry.tsx`) E guarda a função de limpeza em
// `mockFocusEffectCleanups` para os testes simularem BLUR sem depender do
// roteador real/Drawer (que os outros testes deste arquivo não montam —
// mesma razão de `tutores/novo.tsx` ter um teste à parte com o roteador
// real, `NovoTutorScreen.navigation.test.tsx`, fora do escopo desta fix
// wave). `simulateBlur()` chama e ESVAZIA a lista — unmount real (RNTL)
// continua limpando por conta própria via o retorno do `useEffect`.
let mockFocusEffectCleanups: Array<() => void> = [];
function simulateBlur() {
  mockFocusEffectCleanups.forEach((cleanup) => cleanup());
  mockFocusEffectCleanups = [];
}
jest.mock('expo-router', () => {
  const ReactForMock = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (callback: () => void | (() => void)) => {
      ReactForMock.useEffect(() => {
        const cleanup = callback();
        if (typeof cleanup === 'function') {
          mockFocusEffectCleanups.push(cleanup);
        }
        return cleanup;
      }, []);
    },
  };
});

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

import {
  useAgendaSemana,
  useAtualizarStatusAgendamento,
  useAgendaHoje,
  useCheckinAgendamento,
} from '../src/hooks/useAgenda';
const mockUseAgendaSemana = useAgendaSemana as jest.Mock;
const mockUseAtualizarStatusAgendamento = useAtualizarStatusAgendamento as jest.Mock;
const mockUseAgendaHoje = useAgendaHoje as jest.Mock;
const mockUseCheckinAgendamento = useCheckinAgendamento as jest.Mock;

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

const REFETCH_HOJE = jest.fn().mockResolvedValue(undefined);

beforeEach(() => {
  jest.clearAllMocks();
  mockFocusEffectCleanups = [];
  REFETCH.mockResolvedValue(undefined);
  REFETCH_HOJE.mockResolvedValue(undefined);
  setViewport(400, 800);
  mockUseAtualizarStatusAgendamento.mockReturnValue({
    mutate: mockAtualizarStatusMutate,
    isPending: false,
    variables: undefined,
  });
  // REC-12: default 'modo semana' nunca lê estes dois — valores default
  // inofensivos, sobrescritos nos testes do describe 'modo Hoje' abaixo.
  mockUseAgendaHoje.mockReturnValue({
    data: [],
    isLoading: false,
    isError: false,
    refetch: REFETCH_HOJE,
    dataHoje: '2026-09-28',
  });
  mockUseCheckinAgendamento.mockReturnValue({
    mutate: mockCheckinMutate,
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

// ─── REC-12 — modo "Hoje" da agenda ─────────────────────────────────────────
import { Alert } from 'react-native';
jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

function agendamentoHoje(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 30,
    dtInicio: '2026-09-28T09:00:00.000Z',
    nrDuracaoMinutos: 30,
    sgStatus: 'AGENDADA',
    dsStatusOrigem: 'AGENDADO',
    nrVersion: 1,
    pet: { id: 10, nmPet: 'Amora', nmEspecie: 'Cão', nmRaca: 'SRD' },
    tutor: { id: 20, nmTutor: 'Beatriz Lopes', dsTelefone: '11999990001' },
    veterinario: { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345' },
    dsOrigem: 'PORTAL',
    dsEtapaRecepcao: 'AGENDADO',
    ...overrides,
  };
}

describe('AgendaScreen — modo Hoje (REC-12)', () => {
  beforeEach(() => {
    mockUseAgendaSemana.mockReturnValue(makeDefaultHookReturn([]));
  });

  it('default é o modo Semana — a suíte pré-existente continua vendo o comportamento de sempre', () => {
    mockUseAgendaHoje.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: REFETCH_HOJE,
      dataHoje: '2026-09-28',
    });
    const { getByTestId, queryByTestId } = wrap(<AgendaScreen />);
    expect(getByTestId('btn-prev-week')).toBeTruthy();
    expect(queryByTestId('agenda-hoje-lista')).toBeNull();
  });

  it('alternar para "Hoje" troca a lista exibida', () => {
    mockUseAgendaHoje.mockReturnValue({
      data: [agendamentoHoje()],
      isLoading: false,
      isError: false,
      refetch: REFETCH_HOJE,
      dataHoje: '2026-09-28',
    });
    const { getByTestId, queryByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-modo-hoje'));
    expect(queryByTestId('btn-prev-week')).toBeNull();
    expect(getByTestId('agenda-hoje-lista')).toBeTruthy();
    expect(getByTestId('agenda-hoje-card')).toBeTruthy();
  });

  // A-3: "a etapa de recepção é derivada NO SERVIDOR — o app só exibe".
  // MORDIDA: se o app recalculasse a etapa a partir de dsStatus/timestamps em
  // vez de ler `dsEtapaRecepcao` puro, esta fixture (CANCELADO com dtCheckin
  // preenchido — combinação que só aconteceria por dado inconsistente, mas
  // que prova exatamente QUAL fonte o app usa) mostraria "Chegou" em vez de
  // "Cancelado".
  it('mostra a etapa EXATA que veio do servidor, mesmo quando os timestamps sugerem outra coisa', () => {
    mockUseAgendaHoje.mockReturnValue({
      data: [
        agendamentoHoje({
          dsEtapaRecepcao: 'CANCELADO',
          dtCheckin: '2026-09-28T08:00:00',
          dtInicioAtendimento: '2026-09-28T08:10:00',
        }),
      ],
      isLoading: false,
      isError: false,
      refetch: REFETCH_HOJE,
      dataHoje: '2026-09-28',
    });
    const { getByTestId, queryByText } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-modo-hoje'));
    expect(getByTestId('etapa-30')).toBeTruthy();
    expect(queryByText('Cancelado')).toBeTruthy();
    expect(queryByText('Chegou')).toBeNull();
  });

  // A-6: tempo de espera é POR LINHA e usa dtCheckin como origem — dois
  // check-ins DIFERENTES no MESMO instante de render produzem textos
  // DIFERENTES. Se a implementação usasse outro relógio (ex.: o instante em
  // que o card montou) as duas linhas mostrariam o MESMO valor (~0min).
  it('"esperando há N min" usa dtCheckin como origem — duas linhas com checkins diferentes mostram minutos diferentes', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-28T10:00:00'));
    try {
      mockUseAgendaHoje.mockReturnValue({
        data: [
          agendamentoHoje({
            id: 31,
            dsEtapaRecepcao: 'CHEGOU',
            dtCheckin: '2026-09-28T09:50:00', // 10 min atrás
          }),
          agendamentoHoje({
            id: 32,
            dsEtapaRecepcao: 'CHEGOU',
            dtCheckin: '2026-09-28T09:00:00', // 60 min atrás
          }),
        ],
        isLoading: false,
        isError: false,
        refetch: REFETCH_HOJE,
        dataHoje: '2026-09-28',
      });
      const { getByTestId } = wrap(<AgendaScreen />);
      fireEvent.press(getByTestId('btn-modo-hoje'));
      expect(getByTestId('espera-31').props.children.join('')).toBe('Esperando há 10 min');
      expect(getByTestId('espera-32').props.children.join('')).toBe('Esperando há 60 min');
    } finally {
      jest.useRealTimers();
    }
  });

  it('"esperando há" só aparece para etapa CHEGOU, não para as outras', () => {
    mockUseAgendaHoje.mockReturnValue({
      data: [agendamentoHoje({ dsEtapaRecepcao: 'CONFIRMADO' })],
      isLoading: false,
      isError: false,
      refetch: REFETCH_HOJE,
      dataHoje: '2026-09-28',
    });
    const { getByTestId, queryByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-modo-hoje'));
    expect(queryByTestId('espera-30')).toBeNull();
    expect(getByTestId('etapa-30')).toBeTruthy();
  });

  // A-6: "nenhum KPI agregado". Uma tela com várias linhas nunca pode exibir
  // média/taxa/percentual/ocupação — só dado por linha.
  it('sem KPI agregado — nenhuma média/taxa/percentual aparece com múltiplas linhas', () => {
    mockUseAgendaHoje.mockReturnValue({
      data: [
        agendamentoHoje({ id: 40, dsEtapaRecepcao: 'CHEGOU', dtCheckin: '2026-09-28T09:00:00' }),
        agendamentoHoje({ id: 41, dsEtapaRecepcao: 'FINALIZADO' }),
        agendamentoHoje({ id: 42, dsEtapaRecepcao: 'NAO_COMPARECEU' }),
      ],
      isLoading: false,
      isError: false,
      refetch: REFETCH_HOJE,
      dataHoje: '2026-09-28',
    });
    const { getByTestId, queryByText } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-modo-hoje'));
    expect(getByTestId('agenda-hoje-lista')).toBeTruthy();
    expect(queryByText(/médi[ao]/i)).toBeNull();
    expect(queryByText(/taxa/i)).toBeNull();
    expect(queryByText(/ocupação/i)).toBeNull();
    expect(queryByText(/%/)).toBeNull();
  });

  it('selo de origem TRIAGEM_LUNA mostra a urgência; PORTAL mostra "App do tutor"', () => {
    mockUseAgendaHoje.mockReturnValue({
      data: [
        agendamentoHoje({
          id: 50,
          dsOrigem: 'TRIAGEM_LUNA',
          dsNivelUrgenciaOrigem: 'ALTA',
        }),
      ],
      isLoading: false,
      isError: false,
      refetch: REFETCH_HOJE,
      dataHoje: '2026-09-28',
    });
    const { getByTestId, queryByText } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-modo-hoje'));
    expect(getByTestId('origem-50')).toBeTruthy();
    expect(queryByText('Triagem da Luna')).toBeTruthy();
  });

  it('botão "Chegou" chama checkinAgendamento com id e nrVersion corretos', () => {
    mockUseAgendaHoje.mockReturnValue({
      data: [agendamentoHoje({ dsEtapaRecepcao: 'AGENDADO' })],
      isLoading: false,
      isError: false,
      refetch: REFETCH_HOJE,
      dataHoje: '2026-09-28',
    });
    const { getByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-modo-hoje'));
    fireEvent.press(getByTestId('btn-chegou-30'));
    expect(mockCheckinMutate).toHaveBeenCalledWith(
      { idAgendamento: 30, nrVersion: 1 },
      expect.objectContaining({ onSettled: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  // Mordida real do mordida "409 vira aviso e recarrega": simula o servidor
  // devolvendo 409 pro clique de "Chegou" e confirma que o app avisa (não
  // fica em silêncio). O "recarrega" está provado à parte, no nível do hook
  // (useAgenda.test.ts::useCheckinAgendamento — onSettled invalida a query
  // TAMBÉM no erro), porque aqui o hook está mockado por inteiro.
  it('409 no "Chegou" mostra aviso de agendamento desatualizado', () => {
    mockUseAgendaHoje.mockReturnValue({
      data: [agendamentoHoje({ dsEtapaRecepcao: 'AGENDADO' })],
      isLoading: false,
      isError: false,
      refetch: REFETCH_HOJE,
      dataHoje: '2026-09-28',
    });
    const { getByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-modo-hoje'));
    fireEvent.press(getByTestId('btn-chegou-30'));

    const [, callbacks] = mockCheckinMutate.mock.calls[0];
    callbacks.onError({ status: 409, message: 'stale' });

    expect(Alert.alert).toHaveBeenCalledWith(
      'Agendamento desatualizado',
      expect.stringContaining('recarregada'),
    );
  });

  it('botão "Faltou" chama atualizarStatusAgendamento com NAO_COMPARECEU', () => {
    mockUseAgendaHoje.mockReturnValue({
      // etapa AGENDADO + horário 2h atrás -> mostrarFaltou = true.
      data: [
        agendamentoHoje({
          dtInicio: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
          dsEtapaRecepcao: 'AGENDADO',
        }),
      ],
      isLoading: false,
      isError: false,
      refetch: REFETCH_HOJE,
      dataHoje: '2026-09-28',
    });
    const { getByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-modo-hoje'));
    fireEvent.press(getByTestId('btn-faltou-30'));
    expect(mockAtualizarStatusMutate).toHaveBeenCalledWith(
      { idAgendamento: 30, dsStatus: 'NAO_COMPARECEU', nrVersion: 1 },
      expect.objectContaining({ onSettled: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it('"Abrir prontuário" navega para consulta/[idPet] com idAgendamento', () => {
    mockUseAgendaHoje.mockReturnValue({
      data: [agendamentoHoje()],
      isLoading: false,
      isError: false,
      refetch: REFETCH_HOJE,
      dataHoje: '2026-09-28',
    });
    const { getByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-modo-hoje'));
    fireEvent.press(getByTestId('btn-abrir-prontuario-30'));
    expect(mockPush).toHaveBeenCalledWith('/consulta/10?idAgendamento=30');
  });

  it('estado vazio do modo Hoje usa o mesmo KCEmptyState da Semana', () => {
    mockUseAgendaHoje.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: REFETCH_HOJE,
      dataHoje: '2026-09-28',
    });
    const { getByTestId } = wrap(<AgendaScreen />);
    fireEvent.press(getByTestId('btn-modo-hoje'));
    expect(getByTestId('empty-agenda')).toBeTruthy();
  });

  // ─── Fix wave G2 (I-1) — tick local no modo Hoje ─────────────────────────
  //
  // G2 mediu (P1/P3, g2-rec12.md): sem tick nem refetchInterval, "Esperando
  // há N min" e o gate de "Faltou" ficam CONGELADOS no valor do render
  // anterior — o relógio pode andar 30min que a tela não muda sozinha. As 4
  // mordidas abaixo (remover o `setInterval`, remover a dependência de
  // `modo`/`focado`, ou não limpar no unmount/blur) precisam pegar.
  describe('tick de 30s (I-1)', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('"esperando há" avança sozinho depois de 30 min, sem refetch', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-28T10:00:00'));
      mockUseAgendaHoje.mockReturnValue({
        data: [
          agendamentoHoje({ id: 70, dsEtapaRecepcao: 'CHEGOU', dtCheckin: '2026-09-28T09:50:00' }),
        ],
        isLoading: false,
        isError: false,
        refetch: REFETCH_HOJE,
        dataHoje: '2026-09-28',
      });
      const r = wrap(<AgendaScreen />);
      fireEvent.press(r.getByTestId('btn-modo-hoje'));
      expect(r.getByTestId('espera-70').props.children.join('')).toBe('Esperando há 10 min');

      // Jest "modern" fake timers avançam o relógio JUNTO com o timer (o
      // mesmo clock por trás de `advanceTimersByTime`) — `setSystemTime`
      // pula direto pra 10:30; só falta UM tick (30s) pra disparar o
      // `setInterval` e forçar o re-render (avançar mais 30min aqui
      // somaria ao pulo, terminando em 11:00, não 10:30 — achado ao medir).
      act(() => {
        jest.setSystemTime(new Date('2026-09-28T10:30:00'));
        jest.advanceTimersByTime(30_000);
      });

      // MORDIDA: sem o tick, este texto continuaria "10 min" (era exatamente
      // o que a sonda P1 do G2 media).
      // 40min30s (o tick de 30s soma ao pulo pra 10:30 — precisa de pelo
      // menos 1 tick pra disparar o setInterval), Math.round arredonda pra
      // 41 (minutosEsperando, etapaRecepcao.ts).
      expect(r.getByTestId('espera-70').props.children.join('')).toBe('Esperando há 41 min');
      // refetch NÃO foi chamado — o número avançou só por re-render local.
      expect(REFETCH_HOJE).not.toHaveBeenCalled();
    });

    it('"Faltou" aparece sozinho quando o horário marcado chega, sem re-render externo', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-28T09:59:00'));
      mockUseAgendaHoje.mockReturnValue({
        data: [
          agendamentoHoje({ id: 71, dtInicio: '2026-09-28T10:00:00', dsEtapaRecepcao: 'AGENDADO' }),
        ],
        isLoading: false,
        isError: false,
        refetch: REFETCH_HOJE,
        dataHoje: '2026-09-28',
      });
      const r = wrap(<AgendaScreen />);
      fireEvent.press(r.getByTestId('btn-modo-hoje'));
      expect(r.queryByTestId('btn-faltou-71')).toBeNull();

      act(() => {
        jest.setSystemTime(new Date('2026-09-28T10:05:00'));
        jest.advanceTimersByTime(30_000);
      });

      // MORDIDA: sem o tick, o botão continuaria ausente (era a sonda P3).
      expect(r.getByTestId('btn-faltou-71')).toBeTruthy();
    });

    it('o intervalo é limpo ao DESMONTAR a tela', () => {
      jest.useFakeTimers();
      const clearSpy = jest.spyOn(global, 'clearInterval');
      mockUseAgendaHoje.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: REFETCH_HOJE,
        dataHoje: '2026-09-28',
      });
      const r = wrap(<AgendaScreen />);
      fireEvent.press(r.getByTestId('btn-modo-hoje'));
      clearSpy.mockClear();

      r.unmount();

      expect(clearSpy).toHaveBeenCalled();
    });

    it('o intervalo é limpo ao PERDER O FOCO (react-navigation v7 não desmonta)', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-09-28T10:00:00'));
      mockUseAgendaHoje.mockReturnValue({
        data: [
          agendamentoHoje({ id: 72, dsEtapaRecepcao: 'CHEGOU', dtCheckin: '2026-09-28T09:50:00' }),
        ],
        isLoading: false,
        isError: false,
        refetch: REFETCH_HOJE,
        dataHoje: '2026-09-28',
      });
      const r = wrap(<AgendaScreen />);
      fireEvent.press(r.getByTestId('btn-modo-hoje'));
      expect(r.getByTestId('espera-72').props.children.join('')).toBe('Esperando há 10 min');

      act(() => {
        simulateBlur();
      });

      act(() => {
        jest.setSystemTime(new Date('2026-09-28T10:30:00'));
        jest.advanceTimersByTime(30 * 60_000);
      });

      // Sem foco, o intervalo foi limpo — o texto NÃO avança mais.
      expect(r.getByTestId('espera-72').props.children.join('')).toBe('Esperando há 10 min');
    });

    // Nota: não dá pra provar isto lendo o texto renderizado — "esperando"
    // é recomputado do zero em QUALQUER render (inclusive um causado por
    // outro motivo), então o texto sairia certo mesmo com um intervalo
    // vazando por trás. A prova real é de CONTAGEM de chamadas.
    it('trocar para o modo Semana limpa o intervalo do modo Hoje (setInterval/clearInterval)', () => {
      jest.useFakeTimers();
      const setSpy = jest.spyOn(global, 'setInterval');
      const clearSpy = jest.spyOn(global, 'clearInterval');
      mockUseAgendaHoje.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: REFETCH_HOJE,
        dataHoje: '2026-09-28',
      });
      const r = wrap(<AgendaScreen />);
      setSpy.mockClear();
      clearSpy.mockClear();

      fireEvent.press(r.getByTestId('btn-modo-hoje'));
      expect(setSpy).toHaveBeenCalledTimes(1);
      expect(clearSpy).not.toHaveBeenCalled();

      fireEvent.press(r.getByTestId('btn-modo-semana'));
      // MORDIDA: sem `modo` na lista de dependências do efeito, esta
      // chamada não aconteceria (o intervalo continuaria rodando fora do
      // modo Hoje, gastando ciclo à toa numa tela que fica aberta o dia
      // todo).
      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
  });
});
