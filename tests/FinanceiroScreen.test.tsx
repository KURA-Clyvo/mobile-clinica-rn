import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import FinanceiroScreen from '../src/app/(app)/financeiro/index';
import { ROUTES } from '../src/constants/routes';
import { formatarMoeda, formatarPercentual } from '../src/utils/moeda';
import { formatarPeriodoCurto } from '../src/utils/periodoFinanceiro';
import type { ResumoFinanceiroResponse } from '../src/types/api';

// FM-08 (ciclo FIN) — testes do painel de gestão. Mesmo padrão de
// ServicosPrecoScreen.test.tsx (mocka `expo-router` e o hook do domínio, não o service).

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactForMock = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      ReactForMock.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockUseResumoFinanceiroReturn = jest.fn();
jest.mock('@hooks/useFinanceiro', () => ({
  useResumoFinanceiro: (de: string, ate: string) => mockUseResumoFinanceiroReturn(de, ate),
}));

const REFETCH = jest.fn();

const MOCK_RESUMO: ResumoFinanceiroResponse = {
  periodo: {
    de: '2026-09-01',
    ate: '2026-09-30',
    inicioUtc: '2026-09-01T00:00:00.000Z',
    fimExclusivoUtc: '2026-10-01T00:00:00.000Z',
  },
  periodoAnterior: {
    de: '2026-08-01',
    ate: '2026-08-31',
    inicioUtc: '2026-08-01T00:00:00.000Z',
    fimExclusivoUtc: '2026-09-01T00:00:00.000Z',
  },
  receitaBruta: 4820.5,
  nrCobrancas: 12,
  nrAtendimentosCobrados: 9,
  ticketMedio: 535.61,
  receitaBrutaPeriodoAnterior: 3980,
  nrAtendimentosCobradosPeriodoAnterior: 7,
  variacaoPercentual: 21.12,
  mixPorServico: [
    { idServicoPreco: 1, nmServico: 'Consulta de rotina', receita: 3000, nrCobrancas: 5 },
    { idServicoPreco: 2, nmServico: 'Vacina V10', receita: 1500.5, nrCobrancas: 6 },
    { idServicoPreco: null, nmServico: '(avulso)', receita: 320, nrCobrancas: 1 },
  ],
};

function seedGestor() {
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'felipe.ferrete@kura.vet',
    tpPerfil: 'GESTOR',
    usuario: { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345', dsEmail: 'felipe.ferrete@kura.vet' },
    _hasHydrated: true,
  });
}

function seedVeterinarioPuro() {
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'vet@kura.vet',
    tpPerfil: 'VETERINARIO',
    usuario: { id: 2, nmVeterinario: 'Dr. Vet', nrCRMV: 'SP-1', dsEmail: 'vet@kura.vet' },
    _hasHydrated: true,
  });
}

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUseResumoFinanceiroReturn.mockReturnValue({
    data: MOCK_RESUMO,
    isLoading: false,
    isError: false,
    refetch: REFETCH,
    isGestor: true,
  });
});

describe('FinanceiroScreen — guarda de GESTOR (papel-only, sem guarda de ficha)', () => {
  it('um VETERINARIO puro é redirecionado e não vê o conteúdo (useRequireGestor)', () => {
    seedVeterinarioPuro();
    const { queryByTestId } = wrap(<FinanceiroScreen />);
    expect(mockReplace).toHaveBeenCalledWith(ROUTES.app.dashboard);
    expect(queryByTestId('financeiro-painel-row')).toBeNull();
  });

  it('um GESTOR vê o painel normalmente, sem redirecionar', () => {
    seedGestor();
    const { queryByTestId } = wrap(<FinanceiroScreen />);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(queryByTestId('financeiro-painel-row')).toBeTruthy();
  });

  it('botão voltar chama router.back()', () => {
    seedGestor();
    const { getByTestId } = wrap(<FinanceiroScreen />);
    fireEvent.press(getByTestId('btn-voltar-financeiro'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('FinanceiroScreen — estados de carregamento/erro/vazio (mesma doutrina do dashboard)', () => {
  beforeEach(() => seedGestor());

  it('mostra skeleton enquanto carrega', () => {
    mockUseResumoFinanceiroReturn.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });
    const { getByTestId, queryByTestId } = wrap(<FinanceiroScreen />);
    expect(getByTestId('financeiro-painel-skeleton')).toBeTruthy();
    expect(queryByTestId('financeiro-painel-row')).toBeNull();
  });

  // Mesma mordida I-1 da G2 da FM-07: "não sei" NÃO é "não houve".
  it('isError mostra o estado de ERRO, nunca o vazio', () => {
    mockUseResumoFinanceiroReturn.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: REFETCH,
      isGestor: true,
    });
    const { getByTestId, queryByTestId } = wrap(<FinanceiroScreen />);
    expect(getByTestId('erro-financeiro-painel')).toBeTruthy();
    expect(queryByTestId('empty-financeiro-painel')).toBeNull();
    expect(queryByTestId('financeiro-painel-row')).toBeNull();
  });

  it('nrCobrancas === 0 mostra o estado vazio, NUNCA receitaBruta === 0 como gate', () => {
    mockUseResumoFinanceiroReturn.mockReturnValue({
      data: { ...MOCK_RESUMO, nrCobrancas: 0, receitaBruta: 0, mixPorServico: [] },
      isLoading: false,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });
    const { getByTestId, queryByTestId } = wrap(<FinanceiroScreen />);
    expect(getByTestId('empty-financeiro-painel')).toBeTruthy();
    expect(queryByTestId('financeiro-painel-row')).toBeNull();
  });

  it('nrCobrancas > 0 com receitaBruta 0 (cortesia total) NÃO é o estado vazio', () => {
    mockUseResumoFinanceiroReturn.mockReturnValue({
      data: {
        ...MOCK_RESUMO,
        receitaBruta: 0,
        nrCobrancas: 3,
        mixPorServico: [{ idServicoPreco: 1, nmServico: 'Castração social', receita: 0, nrCobrancas: 3 }],
      },
      isLoading: false,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });
    const { queryByTestId } = wrap(<FinanceiroScreen />);
    expect(queryByTestId('empty-financeiro-painel')).toBeNull();
  });
});

describe('FinanceiroScreen — KPI e comparação com o período anterior', () => {
  beforeEach(() => seedGestor());

  it('renderiza receita bruta e ticket médio formatados em BRL', () => {
    const { getAllByTestId } = wrap(<FinanceiroScreen />);
    const values = getAllByTestId('metric-value').map((el) => el.props.children);
    expect(values).toContain(formatarMoeda(4820.5));
    expect(values).toContain(formatarMoeda(535.61));
  });

  it('mostra a comparação com o período anterior quando variacaoPercentual existe', () => {
    const { getByTestId } = wrap(<FinanceiroScreen />);
    const texto = getByTestId('financeiro-painel-comparacao-valor').props.children;
    expect(texto).toContain(formatarPercentual(21.12));
    expect(texto).not.toContain('Sem base de comparação');
  });

  it('variacaoPercentual null mostra a frase honesta com os números crus, nunca 0%', () => {
    mockUseResumoFinanceiroReturn.mockReturnValue({
      data: { ...MOCK_RESUMO, variacaoPercentual: null, receitaBrutaPeriodoAnterior: 0 },
      isLoading: false,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });
    const { getByTestId } = wrap(<FinanceiroScreen />);
    const texto = getByTestId('financeiro-painel-comparacao-valor').props.children;
    expect(texto).toContain('Sem base de comparação');
    expect(texto).toContain(formatarMoeda(0));
    expect(texto).toContain(formatarMoeda(4820.5));
    expect(texto).not.toContain('0,00%');
  });

  // I-2 da G2 da FM-08 -- mesma mordida do NULL que tests/DashboardScreen.test.tsx já vigia
  // para o card do dashboard (`ticketMedio null renderiza o traco, NUNCA "R$ 0,00"`): o
  // painel copiou o `ticketMedio == null ? '—' : ...` do dashboard e não copiou o teste
  // junto. `ticketMedio: null` ocorre quando `nrAtendimentosCobrados === 0` (contrato do
  // backend -- `CalcularTicketMedio` recusa devolver 0 para "não medimos") -- alcançável
  // com cobrança avulsa e nenhum atendimento cobrado, ou o primeiro mês de qualquer clínica.
  it('GESTOR: ticketMedio null renderiza o traço, NUNCA "R$ 0,00"', () => {
    mockUseResumoFinanceiroReturn.mockReturnValue({
      data: { ...MOCK_RESUMO, nrAtendimentosCobrados: 0, ticketMedio: null },
      isLoading: false,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });
    const { getAllByTestId } = wrap(<FinanceiroScreen />);
    const values = getAllByTestId('metric-value').map((el) => el.props.children);
    expect(values).toContain('—');
    expect(values).not.toContain(formatarMoeda(0));
    expect(values).not.toContain('R$ 0,00');
  });
});

describe('FinanceiroScreen — mix por serviço', () => {
  beforeEach(() => seedGestor());

  it('renderiza um item por balde, incluindo o avulso (idServicoPreco null)', () => {
    const { getAllByTestId } = wrap(<FinanceiroScreen />);
    const nomes = getAllByTestId('mix-nome').map((el) => el.props.children);
    expect(nomes).toEqual(['Consulta de rotina', 'Vacina V10', '(avulso)']);
  });

  // M-3 da G2 da FM-08 -- `mix-cobrancas` sem vigia: nada nesta suíte lia o testID
  // `mix-cobrancas` antes desta fix wave (`grep -rc mix-cobrancas tests/` = 0). A legenda
  // do mix (`mixCaption`, strings.ts) promete "a soma dos itens abaixo fecha com a receita
  // bruta do período" -- o mesmo vale, por invariante do backend, para a CONTAGEM: a soma
  // de `nrCobrancas` de cada balde do mix fecha com `resumo.nrCobrancas` (o KPI já vigiado
  // acima nos testes de "renderiza receita bruta..."). Este teste lê o NÚMERO REALMENTE
  // RENDERIZADO em cada `mix-cobrancas` (não o valor da fixture) e soma -- pegaria tanto um
  // valor trocado quanto um literal hardcoded.
  it('a soma das cobranças exibidas em mix-cobrancas reconcilia com resumo.nrCobrancas', () => {
    const somaFixture = MOCK_RESUMO.mixPorServico.reduce((acc, item) => acc + item.nrCobrancas, 0);
    expect(somaFixture).toBe(MOCK_RESUMO.nrCobrancas); // controle: a FIXTURE já reconcilia (12)
    const { getAllByTestId } = wrap(<FinanceiroScreen />);
    const textos = getAllByTestId('mix-cobrancas').map((el) => String(el.props.children).replace(/,/g, ''));
    const somaRenderizada = textos.reduce((acc, t) => acc + parseInt(t, 10), 0);
    expect(somaRenderizada).toBe(MOCK_RESUMO.nrCobrancas);
  });

  // 🔴 O invariante que a task pede para não quebrar: soma das receitas dos baldes ==
  // receitaBruta, exato. Este teste PROVA que a tela lê os 3 baldes da fixture (que já soma
  // 4820.5 -- 3000 + 1500.5 + 320) e não descarta nenhum.
  it('a soma das receitas exibidas nos baldes reconcilia com receitaBruta', () => {
    const soma = MOCK_RESUMO.mixPorServico.reduce((acc, item) => acc + item.receita, 0);
    expect(soma).toBe(MOCK_RESUMO.receitaBruta);
    const { getAllByTestId } = wrap(<FinanceiroScreen />);
    const receitas = getAllByTestId('mix-receita').map((el) => el.props.children);
    expect(receitas).toEqual([formatarMoeda(3000), formatarMoeda(1500.5), formatarMoeda(320)]);
  });

  it('a barra proporcional usa % calculada em JS só para largura (comentário declara isso), não re-arredonda o valor monetário', () => {
    const { getAllByTestId } = wrap(<FinanceiroScreen />);
    const barras = getAllByTestId('mix-barra');
    // Consulta de rotina: 3000 / 4820.5 * 100 -- a LARGURA da barra usa o valor cru (sem
    // arredondar para exibição, ao contrário do rótulo textual `mix-percentual` abaixo, que
    // usa 1 casa decimal só para leitura humana).
    const estiloBarra1 = barras[0]!.props.style; // FM-09: getAllByTestId nao devolve tupla, indice 0 assumido nao-vazio por getAllByTestId ter sido chamado no teste
    const larguraBarra1 = Array.isArray(estiloBarra1)
      ? estiloBarra1.find((s: { width?: unknown }) => s?.width !== undefined)?.width
      : estiloBarra1.width;
    expect(typeof larguraBarra1).toBe('string');
    expect(parseFloat(String(larguraBarra1))).toBeCloseTo((3000 / 4820.5) * 100, 5);
    // O rótulo textual, sim, é arredondado para leitura (1 casa decimal).
    const percentuais = getAllByTestId('mix-percentual').map((el) => el.props.children);
    expect(percentuais[0]).toBe('62,2%');
    // O valor MONETÁRIO exibido continua exato (3000), não a fração calculada.
    const receitas = getAllByTestId('mix-receita').map((el) => el.props.children);
    expect(receitas[0]).toBe(formatarMoeda(3000));
  });

  // 🔴 §3 do brief -- receitaBruta === 0 é alcançável (FM-06 permite cortesia com
  // vlCobrado:0). A barra tem que renderizar 0%, nunca NaN%/Infinity%.
  it('receitaBruta === 0 (cortesia total) não produz NaN/Infinity na barra -- guarda de divisão por zero', () => {
    mockUseResumoFinanceiroReturn.mockReturnValue({
      data: {
        ...MOCK_RESUMO,
        receitaBruta: 0,
        nrCobrancas: 3,
        mixPorServico: [{ idServicoPreco: 1, nmServico: 'Castração social', receita: 0, nrCobrancas: 3 }],
      },
      isLoading: false,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });
    const { getByTestId } = wrap(<FinanceiroScreen />);
    const estiloBarra = getByTestId('mix-barra').props.style;
    const largura = Array.isArray(estiloBarra)
      ? estiloBarra.find((s: { width?: unknown }) => s?.width !== undefined)?.width
      : estiloBarra.width;
    expect(largura).toBe('0%');
    expect(largura).not.toContain('NaN');
    expect(largura).not.toContain('Infinity');
  });

  it('serviço desativado (nome preservado pelo backend) aparece no mix como qualquer outro balde', () => {
    mockUseResumoFinanceiroReturn.mockReturnValue({
      data: {
        ...MOCK_RESUMO,
        mixPorServico: [
          { idServicoPreco: 9, nmServico: 'Banho e tosa (descontinuado)', receita: 4820.5, nrCobrancas: 12 },
        ],
      },
      isLoading: false,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });
    const { getAllByTestId } = wrap(<FinanceiroScreen />);
    const nomes = getAllByTestId('mix-nome').map((el) => el.props.children);
    expect(nomes).toEqual(['Banho e tosa (descontinuado)']);
  });
});

describe('FinanceiroScreen — pull-to-refresh', () => {
  it('GESTOR: chama refetch diretamente (tela inteira já é gated por useRequireGestor, sem guarda dupla)', async () => {
    seedGestor();
    const { UNSAFE_getByType } = wrap(<FinanceiroScreen />);
    const RNRefreshControl = require('react-native/Libraries/Components/RefreshControl/RefreshControl').default;
    const refreshControl = UNSAFE_getByType(RNRefreshControl);
    await refreshControl.props.onRefresh();
    expect(REFETCH).toHaveBeenCalledTimes(1);
  });
});

// M-4/E6 da G2 da FM-08 -- os 2 rótulos de período do painel sem vigia. A G2 mediu que
// trocar `resumo.periodoAnterior` por `resumo.periodo` no card de comparação exibe
// "01/09–30/09 → 01/09–30/09" (comparação de um período consigo mesmo) com a suíte VERDE, e
// que o header mostrando o período ANTERIOR também passava verde. `MOCK_RESUMO` tem
// `periodo` (set/2026) e `periodoAnterior` (ago/2026) DIFERENTES de propósito -- um mock com
// os dois períodos iguais não pegaria nenhuma das duas trocas.
describe('FinanceiroScreen — rótulos de período (M-4/E6 da G2 da FM-08)', () => {
  beforeEach(() => seedGestor());

  it('o header mostra o período ATUAL, nunca o anterior', () => {
    const { getByTestId } = wrap(<FinanceiroScreen />);
    const texto = getByTestId('financeiro-painel-periodo').props.children;
    expect(texto).toBe(formatarPeriodoCurto(MOCK_RESUMO.periodo.de, MOCK_RESUMO.periodo.ate));
    expect(texto).not.toBe(
      formatarPeriodoCurto(MOCK_RESUMO.periodoAnterior.de, MOCK_RESUMO.periodoAnterior.ate),
    );
  });

  it('o card de comparação mostra ANTERIOR → ATUAL, nunca o mesmo período nos dois lados', () => {
    const { getByTestId } = wrap(<FinanceiroScreen />);
    const partes = getByTestId('financeiro-painel-periodos').props.children as unknown[];
    const texto = partes.join('');
    const rotuloAnterior = formatarPeriodoCurto(
      MOCK_RESUMO.periodoAnterior.de,
      MOCK_RESUMO.periodoAnterior.ate,
    );
    const rotuloAtual = formatarPeriodoCurto(MOCK_RESUMO.periodo.de, MOCK_RESUMO.periodo.ate);
    expect(rotuloAnterior).not.toBe(rotuloAtual); // controle: a fixture tem períodos DIFERENTES
    expect(texto).toBe(`${rotuloAnterior} → ${rotuloAtual}`);
  });
});
