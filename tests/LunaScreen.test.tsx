import React from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { ScrollView, Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/theme';
import LunaScreen from '../src/app/(app)/luna';
import { formatDateISO, subDays, addDays } from '../src/utils/date';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// LU-09 — mockado no nível do SERVIÇO (não do hook, porque a Fila da Luna chama
// getTutorById() direto, sem hook próprio) para a ação "Responder no WhatsApp".
const mockGetTutorById = jest.fn();
// LU-09 fix wave 1 (item 2): spread do módulo REAL — precisa manter
// `telefoneDisponivel` de verdade (não um stub), porque `luna.tsx` chama a função de
// exportação nomeada, e um mock que só substituísse `getTutorById` deixaria
// `telefoneDisponivel` undefined, lançando dentro do try/catch e mascarando o
// comportamento real com o alerta genérico de erro.
jest.mock('@services/tutores.service', () => ({
  ...jest.requireActual('@services/tutores.service'),
  getTutorById: (id: number) => mockGetTutorById(id),
}));

// WhatsAppModal usa @hooks/useEventosClinicos (useEnviarWhatsApp) — mockado aqui
// para a Fila da Luna não depender do fluxo de envio real (coberto em
// tests/WhatsAppModal.test.tsx).
const mockMutateWhatsApp = jest.fn();
jest.mock('@hooks/useEventosClinicos', () => ({
  useEnviarWhatsApp: () => ({ mutate: mockMutateWhatsApp, isPending: false }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: { children: unknown; style: unknown }) => {
    const { View } = require('react-native');
    const R = require('react');
    return R.createElement(View, { style }, children);
  },
  // LU-09: WhatsAppModal (montado quando "Responder no WhatsApp" resolve) usa
  // useSafeAreaInsets — sem isto, a chamada devolve undefined e o modal lança ao
  // desestruturar insets.bottom.
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
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
  useTriagens: jest.fn(),
}));

jest.mock('@hooks/useDashboard', () => ({
  useAlertas: jest.fn(),
}));

import { useLunaHealth, useRelatorioTriagens, useTriagens } from '../src/hooks/useLuna';
import { useAlertas } from '../src/hooks/useDashboard';

const mockUseLunaHealth = useLunaHealth as jest.Mock;
const mockUseRelatorioTriagens = useRelatorioTriagens as jest.Mock;
const mockUseTriagens = useTriagens as jest.Mock;
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

// LU-09 — tipo INTERNO já traduzido (dtTriagem como Date) — o mesmo shape que
// luna.service.ts::getTriagens() devolve depois do mapper.
const MOCK_FILA_ITEM_ALTA_1PET = {
  idTriagem: 501,
  dtTriagem: new Date(Date.now() - 40 * 60 * 1000),
  urgencia: 'ALTA' as const,
  sintomas: ['vômito', 'letargia'],
  score: 87,
  regrasVersao: '1.1',
  encaminhadoVet: true,
  tutor: { id: 201, nome: 'Ana Beatriz' },
  pets: [{ id: 301, nome: 'Rex', especie: 'Cão' }],
  trechoMensagem: 'Meu cachorro vomitou 3 vezes hoje...',
};

const MOCK_FILA_ITEM_MEDIA_SEM_TUTOR = {
  idTriagem: 502,
  dtTriagem: new Date(Date.now() - 3 * 60 * 60 * 1000),
  urgencia: 'MEDIA' as const,
  sintomas: ['coceira'],
  score: 34,
  regrasVersao: '1.1',
  encaminhadoVet: false,
  tutor: null,
  pets: [],
  trechoMensagem: 'Notei que ela está se coçando bastante...',
};

const MOCK_FILA = {
  items: [MOCK_FILA_ITEM_ALTA_1PET, MOCK_FILA_ITEM_MEDIA_SEM_TUTOR],
  total: 2,
  page: 1,
  pageSize: 20,
};

function mergedStyle(el: ReactTestInstance) {
  // FM-09: ReactTestInstance.props e { [propName: string]: any } (index signature) -- nao
  // satisfaz estruturalmente { style: unknown } (propriedade nomeada exigida). Tipar pelo
  // tipo real devolvido por getByTestId/getByText/UNSAFE_getByType em vez de uma forma
  // minima ad-hoc.
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
  mockUseTriagens.mockReturnValue({ data: MOCK_FILA, isLoading: false, isError: false });
  mockUseAlertas.mockReturnValue({ data: [] });
  mockGetTutorById.mockResolvedValue({ id: 201, nmTutor: 'Ana Beatriz', nrTelefone: '11988887777' });
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

  // Shape medido contra a Luna real: oracle/kura_api são BOOLEANOS. Com o tipo antigo
  // (string) a tela chamava .toLowerCase() num boolean e ficava em branco.
  it('aceita oracle/kura_api booleanos, que é o que a Luna real devolve', () => {
    mockUseLunaHealth.mockReturnValue({
      data: { status: 'degraded', oracle: true, kura_api: false, httpStatus: 503 as const },
    });
    const { getByTestId } = wrap(<LunaScreen />);
    expect(getByTestId('svc-oracle').props.children).toBe('UP');
    expect(getByTestId('svc-kura_api').props.children).toBe('DOWN');
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

  // LU-09 fix wave 1 (G2-2): dataInicio = hoje - (periodo - 1), não hoje - periodo —
  // com dataFim = hoje+1 (E14), isso mantém o intervalo TOTAL em exatamente `periodo`
  // dias (29 aqui, não 30) para o teto de 90 dias do .NET nunca ser excedido pelo chip
  // 90 (calcularIntervaloPeriodo, ver tests/date.test.ts para a mordida dedicada).
  it('changes period query when pressing "30 dias" chip', () => {
    const { getByTestId } = wrap(<LunaScreen />);
    fireEvent.press(getByTestId('chip-periodo-30'));
    const expectedDate = formatDateISO(subDays(new Date(), 29));
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

  describe('Fila da Luna (LU-09)', () => {
    it('shows the "Fila da Luna" section above the relatório, with urgency chips (clay=ALTA, amber=MEDIA)', () => {
      const { getByText, getByTestId } = wrap(<LunaScreen />);
      expect(getByText('Fila da Luna')).toBeTruthy();
      expect(getByTestId('fila-card-501')).toBeTruthy();
      expect(getByTestId('fila-card-502')).toBeTruthy();
      // Rótulo dentro do KCChip (tone clay=ALTA / amber=MEDIA, ver filaUrgenciaTone).
      expect(getByText('Alta')).toBeTruthy();
      expect(getByText('Média')).toBeTruthy();
      expect(getByTestId('fila-pet-501').props.children).toBe('Rex');
    });

    it('shows the exact empty-state literal when there is no message in the period', () => {
      mockUseTriagens.mockReturnValue({
        data: { items: [], total: 0, page: 1, pageSize: 20 },
        isLoading: false,
        isError: false,
      });
      const { getByText, getByTestId } = wrap(<LunaScreen />);
      expect(getByTestId('empty-fila')).toBeTruthy();
      expect(getByText('Nenhuma mensagem de tutor no período')).toBeTruthy();
    });

    // Critério de aceite literal (§6 LU-09): erro de rede != estado vazio.
    it('a network error does NOT show the empty-state message ("nenhuma mensagem")', () => {
      mockUseTriagens.mockReturnValue({ data: undefined, isLoading: false, isError: true });
      const { getByTestId, queryByTestId, queryByText } = wrap(<LunaScreen />);
      expect(getByTestId('fila-erro')).toBeTruthy();
      expect(queryByTestId('empty-fila')).toBeNull();
      expect(queryByText('Nenhuma mensagem de tutor no período')).toBeNull();
    });

    it('shows skeletons while loading, not the empty state', () => {
      mockUseTriagens.mockReturnValue({ data: undefined, isLoading: true, isError: false });
      const { getAllByTestId, queryByTestId } = wrap(<LunaScreen />);
      expect(getAllByTestId('skeleton-fila').length).toBeGreaterThan(0);
      expect(queryByTestId('empty-fila')).toBeNull();
    });

    it('"Responder no WhatsApp" fetches the phone by tutor id and opens WhatsAppModal', async () => {
      const { getByTestId, queryByTestId } = wrap(<LunaScreen />);
      expect(queryByTestId('recipient-tutor')).toBeNull(); // modal ainda não montado
      fireEvent.press(getByTestId('btn-responder-whatsapp-501'));
      await waitFor(() => expect(mockGetTutorById).toHaveBeenCalledWith(201));
      await waitFor(() => expect(getByTestId('recipient-tutor').props.children).toBe('Ana Beatriz'));
      expect(getByTestId('recipient-pet').props.children).toBe('Rex');
    });

    it('the action "Responder no WhatsApp" is absent when tutor is null (does not crash)', () => {
      const { queryByTestId } = wrap(<LunaScreen />);
      expect(queryByTestId('btn-responder-whatsapp-502')).toBeNull();
    });

    // LU-09 fix wave 1 (item 2, lu-09-revisao.md G2-3): TutorService.cs:97-99 grava o
    // sentinela "Não informado" em NR_TELEFONE quando o cadastro não tem telefone —
    // sem esta checagem o app ofereceria/enviaria "para: Não informado" e a Luna
    // devolveria 502 (Twilio rejeita o destinatário). A checagem só é possível DEPOIS
    // do GET /tutores/{id} (a fila nunca carrega telefone, LGPD), então o modal
    // simplesmente não abre em vez do botão desaparecer antes do clique.
    it('does not open WhatsAppModal when the tutor phone is the backend sentinel "Não informado"', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      mockGetTutorById.mockResolvedValueOnce({
        id: 201,
        nmTutor: 'Ana Beatriz',
        nrTelefone: 'Não informado',
      });
      const { getByTestId, queryByTestId } = wrap(<LunaScreen />);
      fireEvent.press(getByTestId('btn-responder-whatsapp-501'));
      await waitFor(() => expect(mockGetTutorById).toHaveBeenCalledWith(201));
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Telefone não cadastrado', expect.any(String)));
      expect(queryByTestId('recipient-tutor')).toBeNull();
    });

    it('does not open WhatsAppModal when the tutor phone is empty', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      mockGetTutorById.mockResolvedValueOnce({ id: 201, nmTutor: 'Ana Beatriz', nrTelefone: '' });
      const { getByTestId, queryByTestId } = wrap(<LunaScreen />);
      fireEvent.press(getByTestId('btn-responder-whatsapp-501'));
      await waitFor(() => expect(mockGetTutorById).toHaveBeenCalledWith(201));
      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Telefone não cadastrado', expect.any(String)));
      expect(queryByTestId('recipient-tutor')).toBeNull();
    });

    it('"Abrir paciente" appears for ALTA with exactly 1 pet and navigates to the patient', () => {
      const { getByTestId, queryByTestId } = wrap(<LunaScreen />);
      expect(getByTestId('btn-abrir-paciente-501')).toBeTruthy();
      // MEDIA sem pet nenhum -- nunca aparece.
      expect(queryByTestId('btn-abrir-paciente-502')).toBeNull();
      fireEvent.press(getByTestId('btn-abrir-paciente-501'));
      expect(mockPush).toHaveBeenCalledWith('/pacientes/301');
    });

    it('"Abrir paciente" does not appear for ALTA with more than 1 pet', () => {
      mockUseTriagens.mockReturnValue({
        data: {
          items: [
            {
              ...MOCK_FILA_ITEM_ALTA_1PET,
              idTriagem: 503,
              pets: [
                { id: 301, nome: 'Rex', especie: 'Cão' },
                { id: 302, nome: 'Mia', especie: 'Gato' },
              ],
            },
          ],
          total: 1,
          page: 1,
          pageSize: 20,
        },
        isLoading: false,
        isError: false,
      });
      const { queryByTestId } = wrap(<LunaScreen />);
      expect(queryByTestId('btn-abrir-paciente-503')).toBeNull();
    });
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

// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1), item 1 — `empty-alertas` passou
// a usar `KCEmptyState`: título E descrição instrutiva, não mais texto mudo.
describe('LunaScreen — empty state instrutivo (CQ-13)', () => {
  it('empty-alertas mostra título E descrição instrutiva', () => {
    mockUseAlertas.mockReturnValue({ data: [] });
    const { getByTestId, getByText } = wrap(<LunaScreen />);
    expect(getByTestId('empty-alertas')).toBeTruthy();
    // Título idêntico ao texto anterior (sem KCEmptyState) — não é regressão.
    expect(getByText('Nenhum alerta ativo')).toBeTruthy();
    expect(
      getByText('Alertas gerados pela Luna aparecem aqui quando uma triagem precisar da atenção da clínica.'),
    ).toBeTruthy();
  });
});
