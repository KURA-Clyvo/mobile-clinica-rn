import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import LunaScreen from '../src/app/(app)/luna';
import { formatDateISO, subDays, addDays } from '../src/utils/date';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: { children: unknown; style: unknown }) => {
    const { View } = require('react-native');
    const R = require('react');
    return R.createElement(View, { style }, children);
  },
}));

// CQ-07: mock do módulo interno específico (nunca 'react-native' inteiro —
// ver tests/ScreenContainer.test.tsx, que documenta por que espalhar
// requireActual('react-native') derruba a suíte). LunaScreen não consome
// useBreakpoint hoje (a responsividade do reportHeader é resolvida por CSS
// flexWrap, não por branch em JS) — o mock existe só para os 3 testes de
// viewport abaixo poderem renderizar sob uma largura simulada e provar que o
// estilo resolvido não muda no sentido errado entre elas.
const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

function setViewport(width: number, height: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

jest.mock('@hooks/useLuna', () => ({
  useLunaHealth: jest.fn(),
  useRelatorioTriagens: jest.fn(),
}));

jest.mock('@hooks/useDashboard', () => ({
  useAlertas: jest.fn(),
}));

import { useLunaHealth, useRelatorioTriagens } from '../src/hooks/useLuna';
import { useAlertas } from '../src/hooks/useDashboard';

const mockUseLunaHealth = useLunaHealth as jest.Mock;
const mockUseRelatorioTriagens = useRelatorioTriagens as jest.Mock;
const mockUseAlertas = useAlertas as jest.Mock;
const mockInvalidateQueries = jest.fn();

// CQ-09: shape real de GET /ready ({status, oracle, kura_api}) + httpStatus que
// luna.service.ts anexa para distinguir 200 (online) de 503 (degradado). Sem
// sgStatus/servicos/twilio/visaoComputacional — nenhum endpoint real da Luna emite
// essas chaves.
const MOCK_HEALTH_UP = {
  status: 'ok',
  oracle: 'ok',
  kura_api: 'ok',
  httpStatus: 200 as const,
};

const MOCK_HEALTH_DEGRADADO = {
  status: 'degraded',
  oracle: 'ok',
  kura_api: 'down',
  httpStatus: 503 as const,
};

// CQ-09: shape interno do app após tradução (nrTotalTriagens/distribuicaoUrgencia/
// nrEncaminhadasParaVet, ALTO/MEDIO/BAIXO, sem CRITICO — nenhum produtor real emite
// esse nível).
const MOCK_RELATORIO = {
  nrTotalTriagens: 135,
  distribuicaoUrgencia: { BAIXO: 68, MEDIO: 45, ALTO: 22 },
  nrEncaminhadasParaVet: 29,
};

function mergedStyle(el: { props: { style: unknown } }) {
  const styleArr = Array.isArray(el.props.style)
    ? el.props.style.filter(Boolean)
    : [el.props.style];
  return Object.assign({}, ...styleArr);
}

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.invalidateQueries = mockInvalidateQueries;
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockInvalidateQueries.mockResolvedValue(undefined);
  mockUseLunaHealth.mockReturnValue({ data: MOCK_HEALTH_UP });
  mockUseRelatorioTriagens.mockReturnValue({ data: MOCK_RELATORIO, isLoading: false });
  mockUseAlertas.mockReturnValue({ data: [] });
  setViewport(400, 800);
});

describe('LunaScreen', () => {
  it('shows "Online" status when GET /ready respondeu HTTP 200 com tudo up', () => {
    const { getByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('status-text').props.children).toBe('Online');
  });

  it('shows "Degradado" status when GET /ready respondeu HTTP 503 (CQ-09 armadilha: não é Offline)', () => {
    mockUseLunaHealth.mockReturnValue({ data: MOCK_HEALTH_DEGRADADO });
    const { getByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('status-text').props.children).toBe('Degradado');
  });

  it('shows "Offline" status and hides sub-services when Luna is indisponível (getLunaHealth never rejects)', () => {
    mockUseLunaHealth.mockReturnValue({ data: { status: 'indisponivel' } });
    const { getByTestId, queryByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('status-text').props.children).toBe('Offline');
    expect(queryByTestId('sub-services')).toBeNull();
  });

  it('shows 2 sub-service cards (oracle, kura_api) — CQ-09/D-5: twilio/visaoComputacional não têm produtor', () => {
    const { getByTestId, queryByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('svc-oracle')).toBeTruthy();
    expect(getByTestId('svc-kura_api')).toBeTruthy();
    expect(queryByTestId('svc-twilio')).toBeNull();
    expect(queryByTestId('svc-visaoComputacional')).toBeNull();
  });

  it('sub-service card reflects "down" for a service whose value is not ok/up', () => {
    mockUseLunaHealth.mockReturnValue({ data: MOCK_HEALTH_DEGRADADO });
    const { getByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('svc-oracle').props.children).toBe('UP');
    expect(getByTestId('svc-kura_api').props.children).toBe('DOWN');
  });

  // CQ-09 fix wave (G2 Important-1): isLunaHealthUp() foi trocado de testar 'oracle'
  // (uma chave do CORPO do upstream, shape não reverificado — mesmo modo de falha do
  // bug original com 'sgStatus') para testar 'httpStatus' (anexado só no caminho de
  // sucesso por luna.service.ts, não depende do shape real do corpo). Prova: um
  // corpo 200 válido SEM a chave 'oracle' ainda é reconhecido como "up" — não cai em
  // "Offline". O revisor demonstrou o bug antigo com exatamente esta sonda.
  it('corpo 200 sem a chave "oracle" — isLunaHealthUp continua true, tela NÃO cai em "Offline"', () => {
    mockUseLunaHealth.mockReturnValue({
      data: { status: 'ok', kura_api: 'ok', httpStatus: 200 as const },
    });
    const { getByTestId } = wrap(<LunaScreen />);
    // O ponto central do fix: isLunaHealthUp() não descarta mais este health como
    // "sem dados" (o guard antigo, testando 'oracle', teria voltado false aqui e a
    // tela mostraria "Offline" com a Luna no ar — exatamente o bug que este guard
    // corrige). 'Degradado' é o resultado correto e conservador quando um
    // sub-serviço não pode ser confirmado como up (isServicoUp(undefined) = false) —
    // "Offline" seria mentir que a Luna está fora do ar, e "Online" seria mentir que
    // oracle está confirmado up. O que importa é: nunca mais "Offline" aqui.
    expect(getByTestId('status-text').props.children).not.toBe('Offline');
    expect(getByTestId('status-text').props.children).toBe('Degradado');
  });

  // CQ-09 fix wave (G2 Minor-1): mutante que removeu os termos
  // `!isServicoUp(oracle) || !isServicoUp(kura_api)` do cálculo de `degradado` deixou
  // a suíte inteira verde — este teste fixa que "Degradado" também é alcançável SEM
  // um HTTP 503, só por um sub-serviço down (httpStatus 200).
  it('sub-serviço down com HTTP 200 (sem 503) também resulta em "Degradado"', () => {
    mockUseLunaHealth.mockReturnValue({
      data: { status: 'ok', oracle: 'down', kura_api: 'ok', httpStatus: 200 as const },
    });
    const { getByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('status-text').props.children).toBe('Degradado');
  });

  it('changes period query when pressing "30 dias" chip', () => {
    const { getByTestId } = wrap(<LunaScreen />);
    fireEvent.press(getByTestId('chip-periodo-30'));
    const expectedDate = formatDateISO(subDays(new Date(), 30));
    const calls = mockUseRelatorioTriagens.mock.calls;
    const lastCall = calls[calls.length - 1][0] as { dataInicio: string };
    expect(lastCall.dataInicio).toBe(expectedDate);
  });

  // E14 (CQ-09 ledger, pré-requisito dos itens 1-3): dataFim precisa ser o dia
  // SEGUINTE a hoje, não hoje — "hoje" sem hora vira 00:00:00 no .NET e filtra <=,
  // descartando toda triagem gravada com UtcNow (hora real) de hoje. Prova de
  // mordida: se luna.tsx voltasse a mandar formatDateISO(new Date()), este teste
  // falharia (dataFim seria igual a "hoje", não ao dia seguinte).
  it('passes tomorrow (not today) as dataFim to useRelatorioTriagens (E14)', () => {
    wrap(<LunaScreen />);
    const calls = mockUseRelatorioTriagens.mock.calls;
    const lastCall = calls[calls.length - 1][0] as { dataFim: string };
    const expectedAmanha = formatDateISO(addDays(new Date(), 1));
    const hoje = formatDateISO(new Date());
    expect(lastCall.dataFim).toBe(expectedAmanha);
    expect(lastCall.dataFim).not.toBe(hoje);
  });

  it('displays nrTotalTriagens correctly', () => {
    const { getByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('total-triagens').props.children).toBe('Total de triagens: 135');
  });

  it('shows 3 urgency distribution rows (BAIXO/MEDIO/ALTO) — CRITICO removido (CQ-09: sem produtor)', () => {
    const { getByTestId, queryByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('urg-row-BAIXO')).toBeTruthy();
    expect(getByTestId('urg-row-MEDIO')).toBeTruthy();
    expect(getByTestId('urg-row-ALTO')).toBeTruthy();
    expect(queryByTestId('urg-row-CRITICO')).toBeNull();
  });

  it('invalidates luna queries on pull-to-refresh', async () => {
    const { UNSAFE_getByType } = wrap(<LunaScreen />);
    const scrollView = UNSAFE_getByType(ScrollView);
    await act(async () => {
      await scrollView.props.refreshControl.props.onRefresh();
    });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['luna'] });
  });

  // CQ-07 (Bloco 0 §2, B0.5): G4r exige os 3 viewports por teste automatizado,
  // nunca captura de tela. O RN test renderer não computa layout Yoga real
  // (sem measurement nativo neste ambiente jest-expo), então o que estas 3
  // asserções provam é que o ESTILO que habilita o wrap (flexWrap: 'wrap' +
  // flexShrink no título) está presente e não é acidentalmente sobrescrito em
  // nenhuma das 3 larguras — é essa propriedade CSS, resolvida pelo motor de
  // layout real do dispositivo/navegador, que faz o header quebrar quando
  // necessário e ficar lado a lado quando sobra espaço; não há branch em JS
  // por breakpoint neste componente (ver comentário em luna.tsx).
  describe.each([
    [360, 640],
    [768, 1024],
    [1440, 900],
  ])('report header wrap at %ix%i (CQ-07)', (width, height) => {
    beforeEach(() => setViewport(width, height));

    it('reportHeader resolves flexWrap and reportTitle resolves flexShrink', () => {
      const { getByTestId, getByText } = wrap(<LunaScreen />);
      const header = mergedStyle(getByTestId('report-header'));
      const title = mergedStyle(getByText('Relatório de Triagens'));
      expect(header.flexWrap).toBe('wrap');
      expect(title.flexShrink).toBe(1);
    });

    it('periodRow gap comes from the spacing scale, not the old literal 6', () => {
      const { getByTestId } = wrap(<LunaScreen />);
      const periodRow = mergedStyle(getByTestId('period-row'));
      expect(periodRow.gap).toBeGreaterThan(6);
    });
  });
});
