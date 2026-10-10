import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { StyleSheet, ScrollView } from 'react-native';
import { ThemeProvider } from '../src/theme';
import AgendaScreen from '../src/app/(app)/agenda';
import { lightColors } from '../src/theme/tokens';
import { DIA_DO_PRINT, ag } from './helpers_proximos';

// BR-CLI-T06 -- a tela Hoje (modo "hoje" de agenda.tsx): marca "agora", proximo realcado, servico no cartao,
// param de rota `modo=hoje` e rolagem ate o proximo. Relogio congelado em 12:00 de 09/10/2026.

jest.mock('@hooks/useAgenda', () => ({
  useAgendaSemana: jest.fn(),
  useAtualizarStatusAgendamento: jest.fn(),
  useAgendaHoje: jest.fn(),
  useCheckinAgendamento: jest.fn(),
}));
jest.mock('@utils/agora', () => ({ agora: () => new Date(2026, 9, 9, 12, 0, 0) }));
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
let mockSearchParams: { modo?: string } = {};
jest.mock('expo-router', () => {
  const ReactForMock = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useLocalSearchParams: () => mockSearchParams,
    useFocusEffect: (cb: () => void | (() => void)) => {
      ReactForMock.useEffect(() => cb(), []);
    },
  };
});

import { useAgendaSemana, useAtualizarStatusAgendamento, useAgendaHoje, useCheckinAgendamento } from '../src/hooks/useAgenda';

const REFETCH = jest.fn().mockResolvedValue(undefined);
const ok = (data: unknown) => ({ data, isLoading: false, isError: false, refetch: REFETCH });

const DIA = DIA_DO_PRINT.map((a) => ({
  ...a,
  nmTipoConsulta: a.pet.nmPet === 'Nala' ? 'Vacinacao' : a.pet.nmPet === 'Thor' ? 'Consulta de Retorno' : '',
}));

function wrap() {
  return render(
    <ThemeProvider>
      <AgendaScreen />
    </ThemeProvider>,
  );
}

function ordem(root: ReturnType<typeof wrap>['root']): string[] {
  return root
    .findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string')
    .map((n) => n.props.testID as string);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = {};
  (useAgendaSemana as jest.Mock).mockReturnValue({
    ...ok([]),
    semanaStart: new Date(2026, 9, 5),
    semanaEnd: new Date(2026, 9, 11),
  });
  (useAtualizarStatusAgendamento as jest.Mock).mockReturnValue({ mutate: jest.fn(), mutateAsync: jest.fn() });
  (useCheckinAgendamento as jest.Mock).mockReturnValue({ mutate: jest.fn(), mutateAsync: jest.fn() });
  (useAgendaHoje as jest.Mock).mockReturnValue(ok(DIA));
});

describe('Hoje -- marca "agora" e proximo realcado', () => {
  it('a marca "AGORA 12:00" fica entre a Nala (11:50) e a Simba (12:30)', () => {
    mockSearchParams = { modo: 'hoje' };
    const { root, getByTestId } = wrap();
    expect(getByTestId('marca-agora')).toBeTruthy();
    const ids = ordem(root);
    const marca = ids.indexOf('marca-agora');
    // cartoes na ordem do horario; o do meio da marca: Nala antes, Simba depois.
    const antes = ids.slice(0, marca).filter((i) => i === 'agenda-hoje-card').length;
    const depois = ids.slice(marca).filter((i) => i === 'agenda-hoje-card').length;
    // 10 agendamentos: Rex 8:00, Luna 9:00, Bidu 10:00, Max 11:15, Thor 11:45, Nala 11:50 | Simba 12:30, Mel, Bolinha, Fifi
    expect(antes).toBe(6);
    expect(depois).toBe(4);
  });

  it('o proximo (Thor, primeiro ativo que NAO esta em atendimento) vem realcado; Max (em atendimento) nao', () => {
    mockSearchParams = { modo: 'hoje' };
    const { getByTestId, queryAllByTestId } = wrap();
    const proximo = getByTestId('agenda-proximo');
    expect(queryAllByTestId('agenda-proximo')).toHaveLength(1);
    const card = proximo.findByProps({ testID: 'agenda-hoje-card' });
    const st = StyleSheet.flatten(card.props.style);
    expect(st.backgroundColor).toBe(lightColors.primaryPale);
    expect(st.borderColor).toBe(lightColors.primary);
    expect(st.shadowOpacity).toBe(0);
    expect(st.borderLeftWidth).toBeUndefined();
    expect(proximo.findAllByProps({ testID: 'etapa-2' }).length).toBeGreaterThan(0); // Thor = id 2
  });

  it('B-17 na Hoje: atrasado sem check-in antes de um "Chegou" nao e o realce; o realce e quem espera', () => {
    mockSearchParams = { modo: 'hoje' };
    (useAgendaHoje as jest.Mock).mockReturnValue(
      ok([
        ag(1, 'Rex', 9, 0, 'AGENDADO'),
        ag(2, 'Nina', 10, 0, 'CHEGOU', { dtCheckin: '2026-10-09T10:00:00' }),
        ag(3, 'Zeca', 13, 0, 'AGENDADO'),
      ]),
    );
    const { getByTestId, queryAllByTestId } = wrap();
    expect(queryAllByTestId('agenda-proximo')).toHaveLength(1);
    const proximo = getByTestId('agenda-proximo');
    expect(proximo.findAllByProps({ testID: 'etapa-2' }).length).toBeGreaterThan(0); // Nina = id 2
    expect(proximo.findAllByProps({ testID: 'etapa-1' })).toHaveLength(0);
  });

  it('o cartao mostra o servico (D5) quando o mapper o repassa, e nao inventa quando vem vazio', () => {
    mockSearchParams = { modo: 'hoje' };
    const { getByTestId, queryByTestId } = wrap();
    expect(getByTestId('servico-3').props.children).toBe('Vacinacao');
    expect(queryByTestId('servico-4')).toBeNull();
  });

  it('nada dos fluxos da Hoje muda: Chegou/Faltou/Prontuario continuam nos cartoes', () => {
    mockSearchParams = { modo: 'hoje' };
    const { getByTestId } = wrap();
    expect(getByTestId('btn-chegou-3')).toBeTruthy(); // Nala AGENDADO
    expect(getByTestId('btn-faltou-3')).toBeTruthy(); // 11:50 ja passou
    expect(getByTestId('btn-abrir-prontuario-2')).toBeTruthy();
  });

  it('dia so com futuro: a marca vem antes do primeiro cartao', () => {
    mockSearchParams = { modo: 'hoje' };
    (useAgendaHoje as jest.Mock).mockReturnValue(ok(DIA.filter((a) => a.id >= 4 && a.id <= 7)));
    const { root } = wrap();
    const ids = ordem(root);
    expect(ids.indexOf('marca-agora')).toBeLessThan(ids.indexOf('agenda-hoje-card'));
  });
});

describe('Hoje -- param de rota modo=hoje (I2)', () => {
  it('sem param: abre em Semana (default intocado)', () => {
    const { queryByTestId } = wrap();
    expect(queryByTestId('agenda-hoje-lista')).toBeNull();
  });

  it('com modo=hoje: abre direto na Hoje', () => {
    mockSearchParams = { modo: 'hoje' };
    const { getByTestId } = wrap();
    expect(getByTestId('agenda-hoje-lista')).toBeTruthy();
  });

  it('o toggle continua funcionando (Semana -> Hoje por toque)', () => {
    const { getByTestId } = wrap();
    fireEvent.press(getByTestId('btn-modo-hoje'));
    expect(getByTestId('agenda-hoje-lista')).toBeTruthy();
  });
});

describe('Hoje -- abre rolada ao proximo, sem animacao', () => {
  it('quando o realcado mede seu layout, o ScrollView rola ate ele UMA vez e sem animar', () => {
    mockSearchParams = { modo: 'hoje' };
    const scrollTo = jest.spyOn(ScrollView.prototype as unknown as { scrollTo: () => void }, 'scrollTo').mockImplementation(() => {});
    const { getByTestId } = wrap();
    const alvo = getByTestId('agenda-proximo');
    act(() => {
      alvo.props.onLayout({ nativeEvent: { layout: { x: 0, y: 420, width: 390, height: 120 } } });
    });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ y: 412, animated: false });
    act(() => {
      alvo.props.onLayout({ nativeEvent: { layout: { x: 0, y: 500, width: 390, height: 120 } } });
    });
    expect(scrollTo).toHaveBeenCalledTimes(1); // nao brigou com a rolagem do operador
    scrollTo.mockRestore();
  });
});
