import React from 'react';
import { render, waitFor, within, act } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import RNRefreshControl from 'react-native/Libraries/Components/RefreshControl/RefreshControl';
import type { ReactTestInstance } from 'react-test-renderer';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { useOnboardingStore } from '../src/store/onboardingStore';
import DashboardScreen from '../src/app/(app)/dashboard';
import { formatarMoeda } from '../src/utils/moeda';

jest.mock('@hooks/useDashboard', () => ({
  useDashboardHoje: jest.fn(),
  useAlertas: jest.fn(),
  useRecentes: jest.fn(),
}));

// FM-07 — mockado aqui pela MESMA razão dos 3 hooks acima: este arquivo testa o COMPONENTE
// (renderização condicional dado um resultado de hook), não a integração hook->rede->mock,
// que é o que tests/fm07-veterinario-sem-chamada-financeiro.test.tsx prova com a cadeia REAL
// (sem mock deste módulo). Sem este jest.mock, useResumoFinanceiro chamaria useQuery sem
// QueryClientProvider (este arquivo não envolve a árvore num, ver `wrap()`) e QUEBRARIA os
// 39 testes pré-existentes que nunca ouviram falar de financeiro.
jest.mock('@hooks/useFinanceiro', () => ({
  useResumoFinanceiro: jest.fn(),
}));

import { useDashboardHoje, useAlertas, useRecentes } from '../src/hooks/useDashboard';
import { useResumoFinanceiro } from '../src/hooks/useFinanceiro';

const mockUseDashboardHoje = useDashboardHoje as jest.Mock;
const mockUseAlertas = useAlertas as jest.Mock;
const mockUseRecentes = useRecentes as jest.Mock;
const mockUseResumoFinanceiro = useResumoFinanceiro as jest.Mock;

// useWindowDimensions é o que useBreakpoint() consome (nunca Dimensions.get(),
// que não re-renderiza em resize de janela na web). Mesmo padrão de
// ScreenContainer.test.tsx/LunaScreen.test.tsx (CQ-04): mockamos o módulo
// interno específico, não 'react-native' inteiro.
const mockUseWindowDimensions = jest.fn(() => ({ width: 400, height: 800, scale: 1, fontScale: 1 }));
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockUseWindowDimensions(),
}));

function setViewport(width: number, height: number) {
  mockUseWindowDimensions.mockReturnValue({ width, height, scale: 1, fontScale: 1 });
}

const MOCK_VET = {
  id: 1,
  nmVeterinario: 'Dr. Felipe Ferrete',
  nrCRMV: 'SP-12345',
  dsEmail: 'felipe@kuraclinica.com.br',
};

const MOCK_HOJE = {
  metrics: { nrConsultasHoje: 8, nrPacientesAtendidos: 6, nrAlertasAtivos: 3, nrTeleorientacoes: 2 },
  dailySummary: { dsResumo: 'OK', dtUltimaAtualizacao: new Date().toISOString() },
};

const MOCK_ALERTA = {
  id: 1,
  dsTipoAlerta: 'VACINA_VENCIDA' as const,
  dsMensagem: 'Vacina de Mel venceu há 5 dias',
  idPet: 3,
  nmPet: 'Mel',
  dtCriacao: new Date().toISOString(),
};

const MOCK_RECENTE = {
  id: 101,
  nmPet: 'Thor',
  nmTutor: 'Carlos Mendes',
  dtAgendamento: new Date().toISOString(),
  nmTipoConsulta: 'Consulta de Retorno',
  sgStatus: 'AGENDADA' as const,
};

// 3 itens — o suficiente para exercitar agrupamento em pares (2 colunas) com
// resto ímpar, sem depender de um número "redondo" de itens.
const MOCK_RECENTES_3 = [
  MOCK_RECENTE,
  { ...MOCK_RECENTE, id: 102, nmPet: 'Nina' },
  { ...MOCK_RECENTE, id: 103, nmPet: 'Bento' },
];

const MOCK_ALERTAS_3 = [
  MOCK_ALERTA,
  { ...MOCK_ALERTA, id: 2, nmPet: 'Nina' },
  { ...MOCK_ALERTA, id: 3, nmPet: 'Bento' },
];

function noop() {}
const REFETCH = jest.fn().mockResolvedValue(undefined);

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'felipe@kuraclinica.com.br',
    tpPerfil: 'VETERINARIO',
    usuario: MOCK_VET,
  });
  jest.clearAllMocks();
  REFETCH.mockResolvedValue(undefined);
  setViewport(400, 800);
  // FM-07 — default para os 39 testes pré-existentes, que nunca ouviram falar de financeiro
  // e o `tpPerfil: 'VETERINARIO'` do beforeEach acima já garante que o card nem renderiza
  // (isGestor && ...) — o valor aqui só existe para a destructuring de useResumoFinanceiro()
  // não quebrar. Describes que testam o card financeiro de verdade (GESTOR) sobrescrevem via
  // mockUseResumoFinanceiro.mockReturnValue(...) no próprio teste.
  mockUseResumoFinanceiro.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: REFETCH,
    isGestor: false,
  });
});

describe('DashboardScreen — loading state', () => {
  it('shows skeleton placeholders while all data is loading', () => {
    mockUseDashboardHoje.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });
    mockUseAlertas.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });
    mockUseRecentes.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });

    const { getAllByTestId } = wrap(<DashboardScreen />);
    expect(getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('shows metrics-skeleton when hoje is loading', () => {
    mockUseDashboardHoje.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });
    mockUseAlertas.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
    mockUseRecentes.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });

    const { getByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('metrics-skeleton')).toBeTruthy();
  });
});

describe('DashboardScreen — loaded state', () => {
  beforeEach(() => {
    mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
    mockUseAlertas.mockReturnValue({ data: [MOCK_ALERTA], isLoading: false, isError: false, refetch: REFETCH });
    mockUseRecentes.mockReturnValue({ data: [MOCK_RECENTE], isLoading: false, isError: false, refetch: REFETCH });
  });

  // 🔴 E26 (ruling D-3 do Felipe) — ESTE TESTE FIXAVA O DEFEITO.
  //
  // Ele se chamava "shows greeting with user first name" e afirmava
  // `getAllByText(/Dr\./)`, com o comentário "The greeting text includes
  // 'Dr.' as first name". Ou seja: passava verde enquanto a primeira tela
  // pós-login dizia "Boa noite, Dr." — e teria REPROVADO a correção.
  //
  // É a armadilha que o próprio achado E26 nomeia: testar a IMPLEMENTAÇÃO
  // (`firstName` devolve o primeiro token) em vez do REQUISITO (a tela
  // cumprimenta a pessoa pelo nome). Um teste assim é pior que nenhum —
  // não deixa o defeito passar, ele o TRANCA.
  //
  // Reescrito para o requisito, e com a asserção negativa junto: o
  // honorífico não pode voltar.
  it('saudação usa o primeiro NOME, não o honorífico (E26)', () => {
    const { getByTestId } = wrap(<DashboardScreen />);
    const saudacao = within(getByTestId('greeting-block'));

    expect(saudacao.getByText(/Felipe/)).toBeTruthy();
    expect(saudacao.queryByText(/Dr\./)).toBeNull();
  });

  // 🔴 FM-01 — a prova que o backlog exige, literal: store com papel GESTOR
  // e SEM ficha de veterinário, e a tela inicial renderiza sem crash.
  //
  // ⚠️ Este estado NÃO ocorre subindo o app: o registro de clínica
  // (AuthService.RegisterClinicaAsync:296-308) cria o gestor COM vínculo,
  // então o login de demonstração sempre traz `usuario` preenchido. Só
  // existe construído — e é exatamente por isso que ele precisa de teste.
  it('GESTOR sem ficha: a tela inicial renderiza, e a saudação não fica vazia', () => {
    useAuthStore.setState({
      token: 'tok',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      email: 'gestor.silva@kuraclinica.com.br',
      tpPerfil: 'GESTOR',
      usuario: null,
    });

    const { getByTestId } = wrap(<DashboardScreen />);
    const saudacao = within(getByTestId('greeting-block'));

    // Sem a correção, `name` era '' e a linha ficava só "Boa noite" — um
    // cumprimento truncado na primeira tela de toda sessão do gestor.
    expect(saudacao.getByText(/Gestor/)).toBeTruthy();
  });

  // Prova por mordida (dev VsClaude, KURA_BACKLOG_CLINICA_1, task
  // navdrawer-web-layout-fix): `formatDateFull` já devolve tudo minúsculo
  // ("20 de agosto de 2026, quinta-feira"). Contra o `dateText` ANTES do
  // fix (`textTransform: 'capitalize'` no StyleSheet), o snapshot HTML/DOM
  // real ficaria "20 De Agosto De 2026, Quinta-Feira" — mas em
  // `react-native-testing-library` (sem motor CSS) `textTransform` nunca é
  // aplicado ao texto lido por `getByText`, então este teste teria passado
  // mesmo contra o bug (é layout/CSS, não string). A asserção que prova a
  // mordida de verdade é a de `style`: contra o código antigo,
  // `dateStyle.textTransform` seria `'capitalize'`; depois do fix, a
  // propriedade não existe mais — a maiúscula única fica a cargo de
  // `capitalizeFirst()` no próprio texto (string), não do CSS.
  it('capitaliza só a primeira letra da data (pt-BR), não cada palavra via CSS', () => {
    const { getByTestId } = wrap(<DashboardScreen />);
    const dateNode = within(getByTestId('greeting-block')).getByText(
      /^\d{1,2} de [a-zà-ÿ]+ de \d{4}, [a-zà-ÿ-]+$/,
    );
    expect(dateNode).toBeTruthy();

    const dateStyle = StyleSheet.flatten(dateNode.props.style);
    expect(dateStyle.textTransform).toBeUndefined();
  });

  it('renders metrics grid with correct values', () => {
    const { getAllByTestId } = wrap(<DashboardScreen />);
    const values = getAllByTestId('metric-value').map((el) => el.props.children);
    expect(values).toContain(8);
    expect(values).toContain(6);
    expect(values).toContain(3);
    expect(values).toContain(2);
  });

  it('shows metrics grid, not skeleton, when loaded', () => {
    const { getByTestId, queryByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('metrics-grid')).toBeTruthy();
    expect(queryByTestId('metrics-skeleton')).toBeNull();
  });

  it('renders appointment row when recentes has data', () => {
    const { getByText } = wrap(<DashboardScreen />);
    expect(getByText('Thor')).toBeTruthy();
  });

  it('renders alert card when alertas has data', () => {
    const { getByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('alert-message')).toBeTruthy();
  });
});

// FM-04 (revisão pós-medição do maestro, 2026-09-02): antes desta correção,
// o dashboard e a agenda mostravam rótulos DIFERENTES para o MESMO
// agendamento (achado nº 2 replicado entre telas) — dashboard.tsx tinha sua
// própria cópia divergente de statusTone/statusLabel. Estes testes provam
// que hoje as duas telas concordam, usando a MESMA fonte
// (utils/statusAgendamento.ts).
describe('DashboardScreen — status labels agree with the agenda (FM-04)', () => {
  beforeEach(() => {
    mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
    mockUseAlertas.mockReturnValue({ data: [MOCK_ALERTA], isLoading: false, isError: false, refetch: REFETCH });
  });

  it('renders "Confirmada" (not "Em andamento") for a CONFIRMADA recente item', () => {
    mockUseRecentes.mockReturnValue({
      data: [{ ...MOCK_RECENTE, sgStatus: 'CONFIRMADA' as const }],
      isLoading: false,
      isError: false,
      refetch: REFETCH,
    });
    const { getByText, queryByText } = wrap(<DashboardScreen />);
    expect(getByText('Confirmada')).toBeTruthy();
    expect(queryByText('Em andamento')).toBeNull();
  });

  it('renders "Não compareceu" (not "Cancelada") for a NAO_COMPARECEU recente item', () => {
    mockUseRecentes.mockReturnValue({
      data: [{ ...MOCK_RECENTE, sgStatus: 'NAO_COMPARECEU' as const }],
      isLoading: false,
      isError: false,
      refetch: REFETCH,
    });
    const { getByText, queryByText } = wrap(<DashboardScreen />);
    expect(getByText('Não compareceu')).toBeTruthy();
    expect(queryByText('Cancelada')).toBeNull();
  });
});

describe('DashboardScreen — empty states', () => {
  beforeEach(() => {
    mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
    mockUseAlertas.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
    mockUseRecentes.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
  });

  it('shows empty state for appointments when list is empty', () => {
    const { getByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('empty-appointments')).toBeTruthy();
  });

  it('shows empty state for alerts when list is empty', () => {
    const { getByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('empty-alerts')).toBeTruthy();
  });

  // CQ-13 (item 1) — os dois estados vazios passaram a usar `KCEmptyState`:
  // título (idêntico ao texto anterior, sem regressão) E descrição
  // instrutiva, não mais só um `<Text>` mudo.
  it('empty-appointments shows title AND instructive description', () => {
    const { getByText } = wrap(<DashboardScreen />);
    expect(getByText('Nenhum atendimento programado')).toBeTruthy();
    expect(getByText('Quando um agendamento for confirmado, ele aparece aqui.')).toBeTruthy();
  });

  it('empty-alerts shows title AND instructive description', () => {
    const { getByText } = wrap(<DashboardScreen />);
    expect(getByText('Nenhum alerta ativo')).toBeTruthy();
    expect(
      getByText('Alertas de vacina e de temperatura aparecem aqui assim que forem gerados.'),
    ).toBeTruthy();
  });
});

// CQ-13 fix wave (item 3, achado A4 da G2) — nada até esta fix wave provava
// que `<OnboardingChecklist />` está de fato MONTADO pelo dashboard: apagar a
// linha `<OnboardingChecklist />` de `dashboard.tsx` deixava a suíte inteira
// verde (`OnboardingChecklist.test.tsx` só exercita o componente ISOLADO,
// nunca a tela). Mesma classe de gap que a CQ-08 levou 4 sessões pra fechar.
//
// De propósito, SEM mockar `expo-router`: os testes acima deste arquivo já
// não mockam (a tela só usa `expo-router` transitivamente, via
// `OnboardingChecklist`), e a G2 mediu que renderizar com o `<Link>` REAL
// funciona sem erro — é, de quebra, o único ponto da suíte que exercita o
// `<Link asChild>` de verdade (ver task-CQ-13-review.md, "O que verifiquei e
// estava CERTO", item 5).
describe('DashboardScreen — onboarding checklist está MONTADO na tela (CQ-13 fix wave, item 3)', () => {
  beforeEach(() => {
    mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
    mockUseAlertas.mockReturnValue({ data: [MOCK_ALERTA], isLoading: false, isError: false, refetch: REFETCH });
    mockUseRecentes.mockReturnValue({ data: [MOCK_RECENTE], isLoading: false, isError: false, refetch: REFETCH });
    useOnboardingStore.setState({ completedSteps: [], dismissed: false, _hasHydrated: true });
  });

  afterEach(() => {
    // Não deixa o estado hidratado vazar pros describes abaixo (ou de outro
    // arquivo que reimporte o mesmo singleton dentro deste módulo de teste).
    // `act()` porque a árvore renderizada pelo teste ainda está montada
    // aqui (este projeto não usa autocleanup do RNTL) — sem isso o
    // `setState` dispara um re-render de `OnboardingChecklist` fora de
    // `act`, e o React avisa (não falha, mas polui a saída do gate).
    act(() => {
      useOnboardingStore.setState({ completedSteps: [], dismissed: false, _hasHydrated: false });
    });
  });

  it('renderiza o card de onboarding dentro da árvore da tela (não só do componente isolado)', () => {
    const { getByTestId, getByText } = wrap(<DashboardScreen />);
    expect(getByTestId('onboarding-checklist')).toBeTruthy();
    expect(getByText('Primeiros passos')).toBeTruthy();
    expect(getByText('4 de 4 restantes')).toBeTruthy();
  });
});

// CQ-06: prova de mordida — falha contra o dashboard.tsx de `main` (`0f23058`,
// grid fixo em 2×2, `metricsRow` sempre com `flexDirection: 'row'` e sempre 2
// filhos por linha) com `Unable to find an element with testID: metrics-row`
// (e `metrics-skeleton-row`/`appointments-row`/`alerts-row` — esses testIDs
// simplesmente não existiam na árvore antiga). Passa depois da implementação,
// que agrupa os itens por linha conforme a contagem de colunas derivada do
// breakpoint (branch em JS, não CSS — `react-test-renderer` deste projeto
// não computa layout Yoga, então só uma árvore que muda de fato entre
// viewports prova o comportamento; ver brief da task e task-CQ-06-report.md).
//
// G2 fix wave (2026-08-20): viewports da faixa `lg` (1024/1280, mais 1023
// logo abaixo da fronteira) foram acrescentados — a suíte original só
// diferenciava sm/md/xl e nunca testava um viewport que fosse `lg` sem
// também ser `xl`, então nenhuma das duas mutações abaixo era pega
// (achado E1). Ver "PROVA DE MUTAÇÃO" no fim deste describe.
describe('DashboardScreen — responsive grid (CQ-06)', () => {
  // Corte de métricas pós-G2 (achado A): sm→1, md→2, lg→4, xl→4 — `lg` e
  // `xl` produzem a MESMA contagem de colunas (ver comentário de
  // `metricsColumnsFor` em dashboard.tsx), então 1024/1280/1440 são
  // esperados idênticos aqui de propósito, não por coincidência de teste.
  const METRIC_VIEWPORTS = [
    { label: '360×640 (sm) — 1 coluna', width: 360, height: 640, expectedColumns: 1, expectedRows: 4 },
    { label: '768×1024 (md) — 2 colunas', width: 768, height: 1024, expectedColumns: 2, expectedRows: 2 },
    { label: '1023×768 (md, 1px abaixo de lg) — 2 colunas', width: 1023, height: 768, expectedColumns: 2, expectedRows: 2 },
    { label: '1024×768 (lg, fronteira exata) — 4 colunas', width: 1024, height: 768, expectedColumns: 4, expectedRows: 1 },
    { label: '1280×800 (lg, notebook real) — 4 colunas', width: 1280, height: 800, expectedColumns: 4, expectedRows: 1 },
    { label: '1440×900 (xl) — 4 colunas', width: 1440, height: 900, expectedColumns: 4, expectedRows: 1 },
  ];

  // Corte de listas (inalterado pela G2, é literal do brief): sm/md→1,
  // lg/xl→2 a partir de 1024.
  const LIST_VIEWPORTS = [
    { label: '768×1024 (md) — 1 coluna', width: 768, height: 1024, expectedColumns: 1 },
    { label: '1023×768 (md, 1px abaixo de lg) — 1 coluna', width: 1023, height: 768, expectedColumns: 1 },
    { label: '1024×768 (lg, fronteira exata) — 2 colunas', width: 1024, height: 768, expectedColumns: 2 },
    { label: '1280×800 (lg, notebook real) — 2 colunas', width: 1280, height: 800, expectedColumns: 2 },
    { label: '1440×900 (xl) — 2 colunas', width: 1440, height: 900, expectedColumns: 2 },
  ];

  // Confere que uma lista de `totalItems` itens (MOCK_*_3 = 3, ímpar de
  // propósito) foi agrupada em linhas de até `columns` itens, e que TODA
  // linha — inclusive a última, incompleta quando `totalItems % columns !==
  // 0` — tem exatamente `columns` filhos diretos (itens reais + espaçadores
  // invisíveis do fix do achado B). `row.children.length` é contagem
  // estrutural da árvore (não lê `style`/px, que o react-test-renderer não
  // computa) — é o que prova, sem medir largura, que o item solitário de
  // uma linha ímpar deixou de ocupar a linha inteira sozinho.
  //
  // CQ-06 G2 fix wave, RODADA 2 (I-1/M-1/M-3/M-5): a contagem de nós sozinha
  // NÃO prova que o espaçador cumpre a função — um `<View />` sem `style`
  // conta como filho igual a um com `flex: 1`, mas tem largura 0 em Yoga e
  // deixa o item solitário voltar a ocupar 100% da linha (o defeito B de
  // volta). A restrição real do `react-test-renderer` é não computar
  // LAYOUT (px, `onLayout`), não "não enxergar estilo" — `toJSON()` ecoa o
  // estilo declarado (ver comentário de `rowSpacers` em dashboard.tsx), e
  // ler esse estilo é exatamente o que faltava. Por isso, além da
  // cardinalidade, também asseramos: (a) todo filho direto da linha — item
  // real E espaçador — carrega `flex: 1`, o que faz cada um dividir a
  // largura igualmente; (b) a própria `View` da linha é de fato uma linha
  // flex (`flexDirection: 'row'`) com o `gap: 10` correto — sem isso a tela
  // vira 1 coluna empilhada ou perde o espaçamento entre colunas sem
  // nenhum sinal na contagem de filhos.
  function expectRowsGroupedIntoColumns(rows: ReactTestInstance[], itemTestId: string, totalItems: number, columns: number) {
    const expectedRowCount = Math.ceil(totalItems / columns);
    expect(rows).toHaveLength(expectedRowCount);
    rows.forEach((row, i) => {
      const itemsInThisRow = Math.min(columns, totalItems - i * columns);
      expect(within(row).getAllByTestId(itemTestId)).toHaveLength(itemsInThisRow);
      expect(row.children.length).toBe(columns);
      expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row', gap: 10 });
      row.children.forEach((child) => {
        expect(StyleSheet.flatten((child as ReactTestInstance).props.style)).toMatchObject({ flex: 1 });
      });
    });
  }

  describe('loaded metrics grid', () => {
    beforeEach(() => {
      mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
      mockUseAlertas.mockReturnValue({ data: MOCK_ALERTAS_3, isLoading: false, isError: false, refetch: REFETCH });
      mockUseRecentes.mockReturnValue({ data: MOCK_RECENTES_3, isLoading: false, isError: false, refetch: REFETCH });
    });

    it.each(METRIC_VIEWPORTS)(
      'lays out $expectedRows row(s) of $expectedColumns MetricCard(s) at $label',
      ({ width, height, expectedColumns, expectedRows }) => {
        setViewport(width, height);
        const { getAllByTestId } = wrap(<DashboardScreen />);

        const rows = getAllByTestId('metrics-row');
        expect(rows).toHaveLength(expectedRows);

        for (const row of rows) {
          expect(within(row).getAllByTestId('metric-value')).toHaveLength(expectedColumns);
        }

        // Sanity: as 4 métricas continuam todas presentes, só a forma da
        // árvore muda — nenhum dado se perde ao trocar de coluna.
        expect(getAllByTestId('metric-value')).toHaveLength(4);
      },
    );
  });

  describe('metrics skeleton grid follows the same breakpoint', () => {
    beforeEach(() => {
      mockUseDashboardHoje.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });
      mockUseAlertas.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
      mockUseRecentes.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
    });

    it.each(METRIC_VIEWPORTS)(
      'lays out $expectedRows skeleton row(s) of $expectedColumns card(s) at $label',
      ({ width, height, expectedColumns, expectedRows }) => {
        setViewport(width, height);
        const { getAllByTestId } = wrap(<DashboardScreen />);

        const rows = getAllByTestId('metrics-skeleton-row');
        expect(rows).toHaveLength(expectedRows);

        for (const row of rows) {
          expect(within(row).getAllByTestId('skeleton')).toHaveLength(expectedColumns);
        }
      },
    );
  });

  describe('appointments and alerts lists — column count across the lg band', () => {
    beforeEach(() => {
      mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
      mockUseAlertas.mockReturnValue({ data: MOCK_ALERTAS_3, isLoading: false, isError: false, refetch: REFETCH });
      mockUseRecentes.mockReturnValue({ data: MOCK_RECENTES_3, isLoading: false, isError: false, refetch: REFETCH });
    });

    it.each(LIST_VIEWPORTS)(
      'groups 3 items into $expectedColumns column(s) per row at $label',
      ({ width, height, expectedColumns }) => {
        setViewport(width, height);
        const { getAllByTestId } = wrap(<DashboardScreen />);

        const appointmentRows = getAllByTestId('appointments-row');
        const alertRows = getAllByTestId('alerts-row');

        // Achado B (G2): com 3 itens (ímpar) e 2 colunas, a última linha
        // tem 1 item real — a asserção abaixo confere que essa linha ainda
        // assim tem 2 filhos (item + espaçador), não 1.
        expectRowsGroupedIntoColumns(appointmentRows, 'appointments-item', 3, expectedColumns);
        expectRowsGroupedIntoColumns(alertRows, 'alerts-item', 3, expectedColumns);

        // Sanity: todos os itens continuam presentes.
        expect(getAllByTestId('appointments-item')).toHaveLength(3);
        expect(getAllByTestId('alerts-item')).toHaveLength(3);

        // CQ-06 G2 fix wave, RODADA 2 (M-2/mutação "chunk() inverte a
        // ordem"): `row.children.length`/`flex: 1` provam COLUNA, não
        // ORDEM — `chunk()` invertendo os itens dentro de uma linha (ex.:
        // `.slice().reverse()`) não muda cardinalidade nem estilo, só
        // ordem. A ordem de "próximos atendimentos"/"alertas" é relevante
        // para quem usa a tela, então comparamos o `item`/`alerta` de
        // verdade que cada wrapper `testID="appointments-item"`/
        // `"alerts-item"` recebeu (via `.children[0].props`, o componente
        // filho direto — `AppointmentRow`/`AlertCard` — antes de qualquer
        // render interno) contra a ordem original do mock, em sequência
        // através de TODAS as linhas.
        const appointmentIds = getAllByTestId('appointments-item').map(
          (view) => (view.children[0] as ReactTestInstance).props.item.id,
        );
        expect(appointmentIds).toEqual(MOCK_RECENTES_3.map((item) => item.id));

        const alertIds = getAllByTestId('alerts-item').map(
          (view) => (view.children[0] as ReactTestInstance).props.alerta.id,
        );
        expect(alertIds).toEqual(MOCK_ALERTAS_3.map((alerta) => alerta.id));

        // CQ-06 G2 fix wave, RODADA 2 (M-4/mutações M6+M7 — fix do achado
        // H.2 inteiro): nem `alertCardInGrid: { flex: 1, marginBottom: 0 }`
        // nem a passagem do prop `style` de `dashboard.tsx` para
        // `<AlertCard>` tinham qualquer teste — reverter os dois (ou só um)
        // não derrubava nenhum sinal. `view.children[0]` é a instância
        // composta de `<AlertCard>` dentro do wrapper `alerts-item`, e
        // `.props.style` é exatamente o que `dashboard.tsx` passou —
        // achatamos e conferimos as duas metades do fix H.2 em conjunto.
        const alertCardStyles = getAllByTestId('alerts-item').map((view) =>
          StyleSheet.flatten((view.children[0] as ReactTestInstance).props.style),
        );
        alertCardStyles.forEach((style) => {
          expect(style).toMatchObject({ flex: 1, marginBottom: 0 });
        });
      },
    );
  });

  // Achado B (G2), caso extra explicitamente pedido no brief da fix wave:
  // lista com 1 item só em ≥ lg (2 colunas). Sem o fix, o único filho da
  // única linha tem `flex: 1` sozinho numa `View` `flexDirection: 'row'` e
  // ocupa 100% da largura; com o fix, a linha ganha 1 espaçador e passa a
  // ter 2 filhos, dividindo a largura como dividiria se houvesse um 2º item.
  describe('single-item list at >= lg', () => {
    it('pads the lone row with a spacer up to the column count', () => {
      mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
      mockUseAlertas.mockReturnValue({ data: [MOCK_ALERTA], isLoading: false, isError: false, refetch: REFETCH });
      mockUseRecentes.mockReturnValue({ data: [MOCK_RECENTE], isLoading: false, isError: false, refetch: REFETCH });
      setViewport(1440, 900);

      const { getAllByTestId } = wrap(<DashboardScreen />);

      const appointmentRows = getAllByTestId('appointments-row');
      const alertRows = getAllByTestId('alerts-row');
      // CQ-06 G2 fix wave, RODADA 2 (I-1): reaproveita a mesma
      // `expectRowsGroupedIntoColumns` do bloco acima — 2 colunas em xl, 1
      // item real e 1 espaçador por linha, e o espaçador tem que carregar
      // `flex: 1` de verdade (não só existir como nó) para provar que ele
      // ocupa a coluna, não só a contagem de filhos.
      expectRowsGroupedIntoColumns(appointmentRows, 'appointments-item', 1, 2);
      expectRowsGroupedIntoColumns(alertRows, 'alerts-item', 1, 2);
    });
  });

  // CQ-06 G2 fix wave, RODADA 2 (I-2) — os 2 call sites de SKELETON do
  // achado B (`appointments-skeleton-row` em dashboard.tsx:350,
  // `alerts-skeleton-row` em :387) não tinham nenhum teste: removendo
  // `rowSpacers(...)` das duas linhas, a suíte inteira continuava verde. A
  // rodada 1 já tinha nomeado `appointments-skeleton-row` explicitamente no
  // achado B ("a terceira barra cinza nasce com o dobro da largura").
  //
  // `skeletonAppointmentRows = chunk([0,1,2], listColumns)` já produzia
  // resto em `lg`/`xl` (2 colunas: linha de 2 + linha de 1) — coberto
  // diretamente. `skeletonAlertRows`, porém, tinha só 2 placeholders
  // (`chunk([0,1], listColumns)`): com `listColumns` só assumindo 1 ou 2,
  // `missing = columns - itemsInRow` é SEMPRE 0 (2÷1=2 linhas de 1 cada,
  // 2÷2=1 linha de 2) — ou seja, a chamada de `rowSpacers` naquele call
  // site era matematicamente inerte para qualquer viewport testável, e
  // nenhum teste, por mais bem escrito que fosse, conseguiria provar a
  // remoção dela sem mudar o dado de origem. Por isso `skeletonAlertRows`
  // passou a usar 3 placeholders (`[0,1,2]`, igual ao de atendimentos) —
  // mudança mínima de produto, feita só para tornar o call site
  // observável; não muda nenhum comportamento de dado real (é só a
  // contagem de barras cinzas exibidas durante o loading).
  describe('appointments and alerts skeleton lists — column count across the lg band', () => {
    beforeEach(() => {
      mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
      mockUseAlertas.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });
      mockUseRecentes.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: REFETCH });
    });

    it.each(LIST_VIEWPORTS)(
      'pads incomplete skeleton rows to $expectedColumns column(s) per row at $label',
      ({ width, height, expectedColumns }) => {
        setViewport(width, height);
        const { getAllByTestId } = wrap(<DashboardScreen />);

        const appointmentSkeletonRows = getAllByTestId('appointments-skeleton-row');
        const alertSkeletonRows = getAllByTestId('alerts-skeleton-row');

        expectRowsGroupedIntoColumns(appointmentSkeletonRows, 'skeleton', 3, expectedColumns);
        expectRowsGroupedIntoColumns(alertSkeletonRows, 'skeleton', 3, expectedColumns);
      },
    );
  });

  // PROVA DE MUTAÇÃO (achado E1) — documentada aqui em comentário porque a
  // mutação é aplicada manualmente ao arquivo de produção e revertida em
  // seguida; a saída literal de cada rodada está no task-CQ-06-report.md.
  //
  //   Mutação 1 (dashboard.tsx, metricsColumnsFor): `isAtLeast('lg')` →
  //   `isAtLeast('xl')` — em 1024/1280 o grid de métricas passaria a
  //   desenhar 2 colunas em vez de 4. Antes desta fix wave (viewports só em
  //   360/768/1440), essa troca sobrevivia 17/17 verde. Com os viewports
  //   1024/1280 acima, os testes `lays out 1 row(s) of 4 MetricCard(s) at
  //   1024×768...`/`...1280×800...` passam a FALHAR sob a mutação.
  //
  //   Mutação 2 (dashboard.tsx, listColumnsFor): `isAtLeast('lg')` →
  //   `isAtLeast('xl')` — em 1024/1280 as listas passariam a ficar em 1
  //   coluna em vez de 2. Mesma lacuna antes desta fix wave. Com
  //   LIST_VIEWPORTS acima, os testes `groups 3 items into 2 column(s) per
  //   row at 1024×768.../1280×800...` passam a FALHAR sob a mutação.
});

// FM-07 (ciclo FIN) — cards financeiros do dashboard.
//
// Este describe testa o COMPONENTE (useResumoFinanceiro MOCKADO, ver jest.mock no topo do
// arquivo) — a MORDIDA OBRIGATORIA do brief secao 1 ("o veterinario NAO DISPARA a chamada")
// e provada a parte, com a cadeia REAL (sem mock deste hook), em
// tests/fm07-veterinario-sem-chamada-financeiro.test.tsx -- aqui so se prova o que o
// COMPONENTE faz dado um resultado de hook, nao se o hook de fato evita a chamada de rede.

describe('DashboardScreen - financeiro (FM-07)', () => {
  const MOCK_RESUMO = {
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
    mixPorServico: [],
  };

  function logarComoGestor() {
    useAuthStore.setState({
      token: 'tok-gestor',
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      email: 'gestor@kuraclinica.com.br',
      tpPerfil: 'GESTOR',
      usuario: MOCK_VET,
    });
  }

  beforeEach(() => {
    mockUseDashboardHoje.mockReturnValue({ data: MOCK_HOJE, isLoading: false, isError: false, refetch: REFETCH });
    mockUseAlertas.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
    mockUseRecentes.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: REFETCH });
  });

  // Secao 1 do brief, metade "render" da mordida (a metade "nao dispara a chamada" e a suite
  // separada citada no cabecalho). VETERINARIO e o default do beforeEach TOP-LEVEL do
  // arquivo -- nao precisa logarComoGestor() aqui.
  it('VETERINARIO: a secao financeira inteira NAO entra na arvore -- nem card, nem skeleton, nem estado vazio', () => {
    mockUseResumoFinanceiro.mockReturnValue({
      data: MOCK_RESUMO,
      isLoading: false,
      isError: false,
      refetch: REFETCH,
      isGestor: false,
    });

    const { queryByTestId, queryByText } = wrap(<DashboardScreen />);

    expect(queryByTestId('financeiro-row')).toBeNull();
    expect(queryByTestId('financeiro-skeleton')).toBeNull();
    expect(queryByTestId('empty-financeiro')).toBeNull();
    expect(queryByText('Financeiro')).toBeNull();
  });

  it('GESTOR: mostra skeleton de 2 cards enquanto o resumo carrega', () => {
    logarComoGestor();
    mockUseResumoFinanceiro.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });

    const { getByTestId, getAllByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('financeiro-skeleton')).toBeTruthy();
    // 2 cards -- receita bruta + ticket medio (secao 3 do brief).
    expect(getAllByTestId('skeleton').length).toBeGreaterThanOrEqual(2);
  });

  it('GESTOR: renderiza "Receita bruta" e "Ticket medio" ja formatados em BRL', () => {
    logarComoGestor();
    mockUseResumoFinanceiro.mockReturnValue({
      data: MOCK_RESUMO,
      isLoading: false,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });

    const { getByTestId, getAllByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('financeiro-row')).toBeTruthy();
    const values = getAllByTestId('metric-value').map((el) => el.props.children);
    // formatarMoeda(), não literal de string: Intl.NumberFormat('pt-BR', ...) usa espaço
    // NÃO-QUEBRÁVEL (U+00A0) entre "R$" e o número, não o espaço comum -- medido ao vivo
    // (achado do PAR DE INSTRUMENTOS §11: um literal escrito à mão passaria no `grep`
    // visual e falharia em `toContain`, silenciosamente, se não fosse por esta medição).
    expect(values).toContain(formatarMoeda(4820.5));
    expect(values).toContain(formatarMoeda(535.61));
    const labels = getAllByTestId('metric-label').map((el) => el.props.children);
    // Ruling D-6 -- o rotulo e "Receita bruta", com essas palavras.
    expect(labels).toContain('Receita bruta');
    expect(labels).toContain('Ticket médio');
  });

  // Secao 2.3 do brief -- a mordida obrigatoria do NULL: ticketMedio null vira o traco,
  // NUNCA "R$ 0,00" (mentiria "o atendimento medio valeu zero").
  it('GESTOR: ticketMedio null renderiza o traco, NUNCA "R$ 0,00"', () => {
    logarComoGestor();
    mockUseResumoFinanceiro.mockReturnValue({
      data: { ...MOCK_RESUMO, nrAtendimentosCobrados: 0, ticketMedio: null, variacaoPercentual: null },
      isLoading: false,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });

    const { getAllByTestId } = wrap(<DashboardScreen />);
    const values = getAllByTestId('metric-value').map((el) => el.props.children);
    expect(values).toContain('—');
    expect(values).not.toContain(formatarMoeda(0));
  });

  // Secao 2.4 do brief -- os DOIS estados que produzem receitaBruta:0, e por que so um deles
  // e o estado vazio. Estado 1: NADA foi lancado (nrCobrancas:0) -> estado vazio instrutivo.
  it('GESTOR: nrCobrancas === 0 (nada lancado) mostra o estado vazio, NUNCA um card com "R$ 0,00"', () => {
    logarComoGestor();
    mockUseResumoFinanceiro.mockReturnValue({
      data: {
        ...MOCK_RESUMO,
        receitaBruta: 0,
        nrCobrancas: 0,
        nrAtendimentosCobrados: 0,
        ticketMedio: null,
        variacaoPercentual: null,
        mixPorServico: [],
      },
      isLoading: false,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });

    const { getByTestId, queryByTestId } = wrap(<DashboardScreen />);
    expect(getByTestId('empty-financeiro')).toBeTruthy();
    expect(queryByTestId('financeiro-row')).toBeNull();
  });

  // Estado 2: TUDO foi cortesia (nrCobrancas > 0, receitaBruta 0 de verdade) -> "R$ 0,00" e a
  // VERDADE, e mostrar o estado vazio aqui seria o bug que o brief pede para evitar
  // (indistinguivel de "nada foi lancado" quando na verdade houve atendimento cobrado a R$0).
  it('GESTOR: nrCobrancas > 0 com receitaBruta 0 (cortesia total) mostra "R$ 0,00" -- NAO e o estado vazio', () => {
    logarComoGestor();
    mockUseResumoFinanceiro.mockReturnValue({
      data: {
        ...MOCK_RESUMO,
        receitaBruta: 0,
        nrCobrancas: 3,
        nrAtendimentosCobrados: 3,
        ticketMedio: 0,
        variacaoPercentual: null,
        mixPorServico: [{ idServicoPreco: 1, nmServico: 'Castracao social', receita: 0, nrCobrancas: 3 }],
      },
      isLoading: false,
      isError: false,
      refetch: REFETCH,
      isGestor: true,
    });

    const { queryByTestId, getAllByTestId } = wrap(<DashboardScreen />);
    expect(queryByTestId('empty-financeiro')).toBeNull();
    const values = getAllByTestId('metric-value').map((el) => el.props.children);
    // receitaBruta:0 E ticketMedio:0 (0 lucro / 3 atendimentos = 0) -- as DUAS sao R$0,00
    // verdadeiro aqui, diferente do teste anterior (ticketMedio null).
    expect(values.filter((v) => v === formatarMoeda(0)).length).toBe(2);
  });

  // Achado MEDIDO (nao previsto no brief) -- refetch() do React Query bypassa "enabled" (ver
  // comentario em dashboard.tsx::onRefresh e o probe empirico citado no relatorio desta
  // task). Pull-to-refresh so pode incluir refetchFinanceiro() no Promise.all quando
  // isGestor -- senao o "atalho" do refresh reabriria a chamada que "enabled: isGestor"
  // fecha no mount.
  it('pull-to-refresh: GESTOR chama refetchFinanceiro; VETERINARIO NAO chama (refetch() bypassa enabled)', async () => {
    const refetchFinanceiroGestor = jest.fn().mockResolvedValue(undefined);
    logarComoGestor();
    mockUseResumoFinanceiro.mockReturnValue({
      data: MOCK_RESUMO,
      isLoading: false,
      isError: false,
      refetch: refetchFinanceiroGestor,
      isGestor: true,
    });

    const { UNSAFE_getByType } = wrap(<DashboardScreen />);
    const refreshControl = UNSAFE_getByType(RNRefreshControl);
    await act(async () => {
      await refreshControl.props.onRefresh();
    });
    expect(refetchFinanceiroGestor).toHaveBeenCalledTimes(1);
  });

  it('pull-to-refresh: VETERINARIO NAO chama refetchFinanceiro (mesmo ele existindo no hook)', async () => {
    const refetchFinanceiroVet = jest.fn().mockResolvedValue(undefined);
    // VETERINARIO e o default do beforeEach top-level do arquivo -- sem logarComoGestor().
    mockUseResumoFinanceiro.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      refetch: refetchFinanceiroVet,
      isGestor: false,
    });

    const { UNSAFE_getByType } = wrap(<DashboardScreen />);
    const refreshControl = UNSAFE_getByType(RNRefreshControl);
    await act(async () => {
      await refreshControl.props.onRefresh();
    });
    expect(refetchFinanceiroVet).not.toHaveBeenCalled();
  });
});
