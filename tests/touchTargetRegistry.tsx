// CQ-08 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — registry de cobertura para
// `tests/touch-target-coverage.test.ts`, no mesmo espírito de
// `src/smokeCoverage/registry.ts` (TASK-81): toda chave que
// `discoverInteractiveTouchables` encontra PRECISA de entrada aqui, ou o
// teste de cobertura falha. Diferente do registry de rede (que só aponta
// para o NOME de um check externo, verificado por string-match contra
// `smoke-contratos.sh`), aqui cada entrada carrega sua PRÓPRIA verificação —
// não existe "script externo" equivalente para geometria declarada, então o
// registry precisa renderizar o componente real e inspecionar o estilo
// achatado (`StyleSheet.flatten`, nunca layout calculado — v11 do brief da
// task).
//
// 4 categorias, cada uma com um contrato diferente de "razão precisa
// aparecer" (fix wave 3, achados I-1+I-3 da G2 rodada 2, adicionou a
// 2ª e o CONTRATO DE RETORNO abaixo — as outras 3 já existiam):
//   - 'meets-min': geometria EXPLÍCITA nos DOIS EIXOS (height/minHeight E
//     width/minWidth numéricos no estilo achatado) comprovada >= 44px CADA
//     UM por render real — WCAG 2.5.5 é 44×44, as duas dimensões, não uma.
//     `verify()` FALHA se a mutação reduzir qualquer uma das duas — é o
//     que dá a mordida.
//   - 'meets-min-one-axis': geometria EXPLÍCITA em UM eixo só, comprovada
//     >= 44px por render real, com o outro eixo genuinamente não fixável
//     sem quebrar layout (razão obrigatória, mesmo contrato de >10
//     caracteres das categorias não-conformes abaixo). Existe porque a
//     rodada anterior tratava "prova 1 eixo" e "prova os 2" como o mesmo
//     rótulo `meets-min` — o resumo dizia `{"meets-min":5}` quando só 3
//     das 5 provavam os dois eixos (`KCButton.tsx::KCButton#1` só altura —
//     botão full-width/dimensionado por conteúdo, cravar largura quebraria
//     layout — e `agenda.tsx::AgendaScreen#3` só largura, ANTES desta wave
//     corrigir o componente para declarar `minHeight` também e virar
//     `meets-min` de verdade). Único uso real hoje: `KCButton`.
//   - 'allowlisted-below-min': geometria explícita, mas ABAIXO do mínimo,
//     com razão documentada (nenhuma entrada usa esta categoria hoje — os 3
//     touchables com geometria explícita, KCButton/KCChip/AppHeader×2, foram
//     corrigidos ou já cumpriam; ver task-CQ-08-report.md para a decisão
//     sobre `KCButton.sm`). Categoria mantida no tipo para o dia em que
//     alguém precisar dela — não removida "porque está vazia hoje" (mesmo
//     raciocínio do `TenantFilterCoverageTests.cs` manter uma allowlist
//     nomeada em vez de um array vazio).
//   - 'no-explicit-geometry': o touchable não declara height/minHeight nem
//     width/minWidth no estilo — depende de padding/conteúdo (não
//     verificável sem layout Yoga real, que este ambiente de teste não
//     computa). `verify()` confirma que a AUSÊNCIA é real (não uma alegação
//     stale) — sem isso, "não coberto" também apodreceria em silêncio, na
//     direção oposta de "meets-min" mentir para cima.
//
// CONTRATO DE RETORNO (fix wave 3): até esta wave, `verify()` era
// `() => void` — livre para chamar qualquer `expect()`, sem que nada
// confrontasse o que ela MEDIU contra a categoria DECLARADA na entrada. A
// G2 rodada 2 mediu 2 formas de explorar isso: (a) reetiquetar uma entrada
// `no-explicit-geometry` para `meets-min` sem tocar `verify()` — o resumo
// passava a anunciar conformidade nunca provada; (b) um `verify()`
// decorativo (`expect(true).toBe(true); return;`) satisfazia
// `expect.hasAssertions()` sem medir nada. Hoje `verify()` DEVOLVE
// `ResultadoVerify { categoriaMedida, eixos }` — subproduto REAL da
// medição, nunca declarado à mão pela entrada — e o gate
// (`tests/touch-target-coverage.test.ts`) confronta `categoriaMedida`
// contra `entrada.category` e, para `meets-min`, exige os dois `eixos`
// presentes. Os helpers `expectAltura44`/`expectLargura44` devolvem o eixo
// que provaram; `expectSemGeometriaExplicita` devolve
// `{categoriaMedida: 'no-explicit-geometry', eixos: []}` diretamente —
// nenhum `verify()` monta esse objeto à mão fora dos helpers.
//
// Fix wave 2b (achado 2 da G2): as 14 entradas de `src/app/` no fim deste
// registry (a partir de `(app)/agenda.tsx::AgendaAppointmentCard#1`) seguem
// o MESMO contrato acima — nenhuma categoria nova, nenhuma exceção. O
// achado da classificação real: nenhuma delas tem geometria EXPLÍCITA
// abaixo de 44px (a suposição inicial do maestro era que esta wave seria o
// primeiro uso real de `allowlisted-below-min`) — 13 são
// `no-explicit-geometry` (inclusive violações REAIS conhecidas, como
// `agenda.tsx::navBtn` — `padding:4` sobre ícone 20px, ≈28px, mas SEM
// height/width explícitos — a categoria captura corretamente "não
// afirmamos conformidade", não "está conforme") e 1 (`AgendaScreen#3`/
// `day-tab`) é `meets-min`. Atualizado na fix wave 3 (achado I-1 da G2
// rodada 2): originalmente só `minWidth:44` era explícito (1 eixo só,
// exatamente no piso) — o componente ganhou `minHeight:44` também, então
// hoje prova os DOIS eixos de verdade. Ver
// `src/a11y/discoverInteractiveTouchables.ts` (bloco "Limitação de
// verificação") e task-CQ-08-report.md, seção "Fix wave 2b", para o
// detalhe completo da wave original; task-CQ-08-fixwave3-report.md para
// esta correção.
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet, TouchableOpacity, Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { ThemeProvider } from '../src/theme';
import { touchTarget } from '../src/theme/tokens';
import { useAuthStore } from '../src/store/authStore';
import { KCButton } from '../src/components/primitives/KCButton';
import { KCCard } from '../src/components/primitives/KCCard';
import { KCChip } from '../src/components/primitives/KCChip';
import { KCTextField } from '../src/components/primitives/KCTextField';
import { AppHeader } from '../src/components/layout/AppHeader';
import { NavDrawer } from '../src/components/layout/NavDrawer';
import { LunaSuggestionBadge } from '../src/components/domain/LunaSuggestionBadge';
import { PetListItem } from '../src/components/domain/PetListItem';
import { TimelineItem } from '../src/components/domain/TimelineItem';
import { WhatsAppModal } from '../src/components/domain/WhatsAppModal';
import { AgendamentoStatusMenu } from '../src/components/domain/AgendamentoStatusMenu';
// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — 2 tocáveis novos em
// `src/components/{primitives,domain}` (KCEmptyState, OnboardingChecklist) +
// 1 em `src/app/(app)/settings.tsx` (SettingsScreen#4, "Rever primeiros
// passos") entram na descoberta por AST — cada um precisa de entrada abaixo.
import { OnboardingChecklist } from '../src/components/domain/OnboardingChecklist';
import { KCEmptyState } from '../src/components/primitives/KCEmptyState';
import { useOnboardingStore } from '../src/store/onboardingStore';
import { ROUTES } from '../src/constants/routes';
import type {
  PetResponse,
  TimelineEventResponse,
  AgendamentoResponse,
  MedicamentoResponse,
} from '../src/types/api';
// Achado 2 (fix wave 2b): as 7 telas de `src/app/` que entraram na
// descoberta nesta rodada — importadas aqui, no MESMO arquivo dos mocks
// abaixo, de propósito: `jest.mock()` é resolvido pelo grafo de módulos do
// arquivo de TESTE inteiro (`touch-target-coverage.test.ts`), não por
// arquivo-fonte — 2 registries em arquivos diferentes chamando
// `jest.mock('expo-router', ...)` com fábricas DIFERENTES para o mesmo
// caminho de módulo arriscaria colisão de mock dependendo da ordem de
// import. Um único arquivo elimina esse risco por construção.
import AgendaScreen from '../src/app/(app)/agenda';
import PacienteDetailScreen from '../src/app/(app)/pacientes/[id]';
import PacientesScreen from '../src/app/(app)/pacientes/index';
import ReceituarioScreen from '../src/app/(app)/receituario/[idPet]';
import SettingsScreen from '../src/app/(app)/settings';
import LoginScreen from '../src/app/login';
import RegisterScreen from '../src/app/register';

// --- Mocks compartilhados — só o necessário pra renderizar AppHeader/
// NavDrawer/WhatsAppModal fora do app real. Padrões copiados dos testes que
// já existem pra cada componente (AppHeader.test.tsx, NavDrawer.test.tsx,
// WhatsAppModal.test.tsx), não inventados aqui. ---

const mockPush = jest.fn();
// Achado 2 (fix wave 2b): `replace`/`back` e `useLocalSearchParams` entraram
// porque as 7 telas novas os usam (`login.tsx`/`register.tsx` chamam
// `router.replace`/`router.push`; `pacientes/[id].tsx`/
// `receituario/[idPet].tsx` leem `useLocalSearchParams`) — copiado do
// padrão de `AgendaScreen.test.tsx`/`PatientDetailScreen.test.tsx`, não
// inventado. Um mock que não expõe TODA chave que a tela desestrutura
// quebra o render com "X is not a function", não com erro claro de import
// faltando — por isso a extensão cobre a UNIÃO do que as 7 telas usam, não
// só o que cada entrada individual chama.
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn(() => ({}) as Record<string, string>);
jest.mock('expo-router', () => {
  const ReactForMock = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
    useLocalSearchParams: () => mockUseLocalSearchParams(),
    Link: ({
      href,
      asChild,
      children,
    }: {
      href: string;
      asChild?: boolean;
      children: React.ReactNode;
    }) => {
      if (asChild && ReactForMock.isValidElement(children)) {
        return ReactForMock.cloneElement(children, { accessibilityHint: `href:${href}` });
      }
      return ReactForMock.createElement(ReactForMock.Fragment, null, children);
    },
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactForMock = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({
      children,
      style,
      edges,
    }: {
      children: React.ReactNode;
      style?: unknown;
      edges?: unknown;
    }) => ReactForMock.createElement(View, { style, edges }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockMutateWhatsApp = jest.fn();
// Achado 2 (fix wave 2b): `receituario/[idPet].tsx` é a única tela nova que
// importa `@hooks/useEventosClinicos` — junto de `useEnviarWhatsApp` (já
// mockado), ela desestrutura mais 4 hooks. Estendido, não recriado, para
// não arriscar 2 mocks divergentes do mesmo módulo (ver comentário acima).
const mockMutateCriarPrescricao = jest.fn();
const mockMutateGerarReceituario = jest.fn();
const mockMutateBaixarReceituario = jest.fn();
const mockUseMedicamentosReturn = jest.fn(() => ({ items: [] as MedicamentoResponse[] }));
jest.mock('@hooks/useEventosClinicos', () => ({
  useEnviarWhatsApp: () => ({ mutate: mockMutateWhatsApp, isPending: false }),
  useCriarPrescricao: () => ({ mutate: mockMutateCriarPrescricao, isPending: false }),
  useGerarReceituario: () => ({ mutate: mockMutateGerarReceituario, isPending: false }),
  useBaixarReceituario: () => ({ mutate: mockMutateBaixarReceituario, isPending: false }),
  useMedicamentos: () => ({ data: mockUseMedicamentosReturn() }),
}));

// Achado 2 (fix wave 2b): 4 hooks de dado novos, um por hook que as telas
// de `src/app/` importam — mesmo padrão dos mocks acima (só as chaves que
// o módulo real exporta e a tela sob teste usa). `mockReturnValue` de cada
// um é setado por entrada dentro do `verify()` correspondente, nunca aqui.
const mockUsePetDetailReturn = jest.fn(() => ({
  data: undefined as PetResponse | undefined,
  isLoading: false,
  isError: false,
}));
jest.mock('@hooks/usePetDetail', () => ({ usePetDetail: () => mockUsePetDetailReturn() }));

const mockUsePetTimelineReturn = jest.fn(() => ({
  data: [] as TimelineEventResponse[],
  isLoading: false,
}));
jest.mock('@hooks/usePetTimeline', () => ({ usePetTimeline: () => mockUsePetTimelineReturn() }));

const mockUsePetsReturn = jest.fn(() => ({
  data: [] as PetResponse[],
  isLoading: false,
  refetch: jest.fn(),
}));
jest.mock('@hooks/usePets', () => ({ usePets: () => mockUsePetsReturn() }));

const mockUseAgendaSemanaReturn = jest.fn(() => ({
  data: [] as AgendamentoResponse[],
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
  semanaStart: new Date(),
  semanaEnd: new Date(),
}));
// FM-04: AgendamentoStatusMenu (montado sempre dentro de AgendaScreen, ainda
// que com visible=false) chama useAtualizarStatusAgendamento() — sem
// mocká-lo aqui, `undefined()` derruba TODO render de AgendaScreen neste
// arquivo (as 4 entradas `(app)/agenda.tsx::AgendaScreen#*`/
// `AgendaAppointmentCard#*` do registry abaixo).
const mockUseAtualizarStatusAgendamentoReturn = jest.fn(() => ({
  mutate: jest.fn(),
  isPending: false,
  variables: undefined,
}));
jest.mock('@hooks/useAgenda', () => ({
  useAgendaSemana: () => mockUseAgendaSemanaReturn(),
  useAtualizarStatusAgendamento: () => mockUseAtualizarStatusAgendamentoReturn(),
}));

// `login.tsx`/`register.tsx` usam os hooks REAIS `useLoginMutation`/
// `useRegisterMutation` (`@hooks/useAuth`, não mockado) — são wrappers finos
// de `useMutation`; mockar o hook inteiro esconderia mais do que mockar só
// a chamada de rede que ele encapsula. Mesmo padrão de
// `LoginScreen.test.tsx`/`RegisterScreen.test.tsx`: mocka-se
// `@services/auth.service`, e `wrapWithQuery()` (abaixo) fornece o
// `QueryClientProvider` que `useMutation` exige.
jest.mock('@services/auth.service', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  registerClinica: jest.fn(),
}));

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function wrapWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </ThemeProvider>,
  );
}

function flat(style: unknown): Record<string, unknown> {
  return (StyleSheet.flatten(style) as Record<string, unknown>) ?? {};
}

/** Maior valor NUMÉRICO entre os 2 campos, ou `undefined` se os 2 estiverem
 *  ausentes/não-numéricos — nunca trata `undefined` como `0` no resultado
 *  final (diferença importante de "nenhum dos dois declarado" vs. "declarado
 *  como 0"). */
function maiorDeclarado(
  estilo: Record<string, unknown>,
  campoA: string,
  campoB: string,
): number | undefined {
  const a = typeof estilo[campoA] === 'number' ? (estilo[campoA] as number) : undefined;
  const b = typeof estilo[campoB] === 'number' ? (estilo[campoB] as number) : undefined;
  if (a === undefined && b === undefined) return undefined;
  return Math.max(a ?? 0, b ?? 0);
}

/** Eixo que um helper de asserção provou por render real — subproduto da
 *  medição, nunca declarado à mão por uma entrada do registry (fix wave 3,
 *  achados I-1+I-3 da G2 rodada 2: sem isto, nada impedia uma entrada de
 *  DECLARAR o eixo que "provou" sem o `verify()` realmente ter medido). */
export type EixoProvado = 'altura' | 'largura';

/** O que `verify()` MEDIU de verdade, para o gate confrontar contra o que a
 *  entrada DECLAROU (`entrada.category`) — ver "CONTRATO DE RETORNO" no
 *  cabeçalho deste arquivo. */
export interface ResultadoVerify {
  categoriaMedida: TouchTargetCategory;
  eixos: EixoProvado[];
}

function expectAltura44(estilo: Record<string, unknown>): EixoProvado {
  const altura = maiorDeclarado(estilo, 'height', 'minHeight');
  expect(altura).toBeDefined();
  expect(altura as number).toBeGreaterThanOrEqual(touchTarget.min);
  return 'altura';
}

function expectLargura44(estilo: Record<string, unknown>): EixoProvado {
  const largura = maiorDeclarado(estilo, 'width', 'minWidth');
  expect(largura).toBeDefined();
  expect(largura as number).toBeGreaterThanOrEqual(touchTarget.min);
  return 'largura';
}

/** Confirma a AUSÊNCIA de geometria explícita nos 2 eixos e devolve o
 *  `ResultadoVerify` já pronto — nenhuma entrada 'no-explicit-geometry'
 *  monta esse objeto à mão, todas devolvem o retorno deste helper direto. */
function expectSemGeometriaExplicita(estilo: Record<string, unknown>): ResultadoVerify {
  expect(maiorDeclarado(estilo, 'height', 'minHeight')).toBeUndefined();
  expect(maiorDeclarado(estilo, 'width', 'minWidth')).toBeUndefined();
  return { categoriaMedida: 'no-explicit-geometry', eixos: [] };
}

export type TouchTargetCategory =
  | 'meets-min'
  | 'meets-min-one-axis'
  | 'allowlisted-below-min'
  | 'no-explicit-geometry';

export interface TouchTargetRegistryEntry {
  category: TouchTargetCategory;
  /** Obrigatório para toda categoria que não seja 'meets-min' (inclui
   *  'meets-min-one-axis' — provar 1 eixo só também exige explicar por que
   *  o outro não é fixável) — checado à parte pelo teste de "toda entrada
   *  não-conforme carrega razão". */
  reason?: string;
  /** Renderiza o componente real, faz as asserções E DEVOLVE o que mediu —
   *  nunca decorativo: mutar a fonte (ex.: baixar um `height`) FAZ este
   *  `verify()` falhar, e o gate confronta o retorno contra
   *  `entrada.category` (fix wave 3 — ver "CONTRATO DE RETORNO" acima). */
  verify: () => ResultadoVerify;
}

const PET_FIXTURE: PetResponse = {
  id: 1,
  nmPet: 'Thor',
  nmEspecie: 'Cão',
  nmRaca: 'Labrador Retriever',
  dtNascimento: '2020-03-15T00:00:00.000Z',
  sgSexo: 'M',
  sgPorte: 'G',
  tutores: [{ id: 10, nmTutor: 'Carlos Mendes', dsTelefone: '11999990001', dsEmail: 'c@e.com' }],
};

const TIMELINE_EVENTO_FIXTURE: TimelineEventResponse = {
  idEventoClinico: 1,
  nmTipo: 'CONSULTA',
  dtEvento: new Date(Date.now() - 2 * 86400000).toISOString(),
  dsObservacao: 'Observação de teste.',
  nmVeterinario: 'Dr. Felipe Ferrete',
};

// Fix wave 2b (achado 2) — fixtures dos 2 hooks novos que ainda não tinham
// fixture neste arquivo (`useAgendaSemana`, `useMedicamentos`).
const TODAY_9AM = (() => {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  return d;
})();

const AGENDAMENTO_FIXTURE: AgendamentoResponse = {
  id: 1,
  dtInicio: TODAY_9AM.toISOString(),
  nrDuracaoMinutos: 30,
  sgStatus: 'AGENDADA',
  // FM-04: campos novos e obrigatórios de AgendamentoResponse. dsStatusOrigem
  // 'AGENDADO' (não terminal) é necessário para o botão "Status"
  // (AgendaAppointmentCard#2) aparecer no render — um status terminal faria
  // `getTransicoesPermitidas` devolver [] e o touchable nem existir.
  dsStatusOrigem: 'AGENDADO',
  nrVersion: 1,
  pet: { id: 1, nmPet: 'Thor', nmEspecie: 'Cão', nmRaca: 'Labrador' },
  tutor: { id: 1, nmTutor: 'Carlos Mendes', dsTelefone: '11999990001' },
  veterinario: { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345' },
};

const MEDICAMENTO_FIXTURE: MedicamentoResponse = {
  id: 1,
  nmMedicamento: 'Amoxicilina',
  dsPrincipioAtivo: 'Amoxicilina',
  dsConcentracao: '500mg',
  dsApresentacao: 'Comprimido',
};

function makeDrawerState(): DrawerContentComponentProps['state'] {
  return {
    index: 0,
    routes: [{ key: 'dashboard', name: 'dashboard' }],
  } as unknown as DrawerContentComponentProps['state'];
}

const navigationMock = {
  navigate: jest.fn(),
  toggleDrawer: jest.fn(),
} as unknown as DrawerContentComponentProps['navigation'];

function renderNavDrawerComUsuario() {
  // FM-01 — `email` e `tpPerfil` entram aqui por NECESSIDADE, nao por
  // simetria: o rodape do NavDrawer (identidade + botao de sair) passou a
  // gatear em `email`, nao mais em `usuario`. O motivo da troca e que um
  // GESTOR sem ficha de veterinario ficava sem nome em lugar nenhum do app
  // -- e, pior, sem botao de sair pelo drawer.
  //
  // Sem estes 2 campos, `nav-drawer-logout` nao renderiza e este registro
  // falha com "Expected at least one assertion" -- foi exatamente assim que
  // a mudanca de gate apareceu. O detector fez o trabalho dele.
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    email: 'f@k.com',
    tpPerfil: 'VETERINARIO',
    usuario: { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345', dsEmail: 'f@k.com' },
  });
  return wrap(
    <NavDrawer
      state={makeDrawerState()}
      navigation={navigationMock}
      descriptors={{} as DrawerContentComponentProps['descriptors']}
    />,
  );
}

export const TOUCH_TARGET_REGISTRY: Record<string, TouchTargetRegistryEntry> = {
  'KCButton.tsx::KCButton#1': {
    category: 'meets-min-one-axis',
    reason:
      'Prova só o eixo ALTURA (`sizeSpec.height`, 44/48/54px pelos 3 tamanhos) — `KCButton` ' +
      'não declara `width`/`minWidth` nenhum, de propósito: o botão é full-width no fluxo do ' +
      'app (`style` do container pai decide a largura) OU dimensionado pelo texto do filho ' +
      '(`children`), nunca por um valor fixo do próprio componente. Cravar `minWidth:44` aqui ' +
      'quebraria o layout de qualquer tela que dependa do botão encolher para o texto (fix ' +
      'wave 3, ruling do maestro: NÃO forçar largura no componente).',
    verify: () => {
      let eixos: EixoProvado[] = [];
      (['sm', 'md', 'lg'] as const).forEach((size) => {
        const { UNSAFE_getByType, unmount } = wrap(<KCButton size={size}>Texto</KCButton>);
        const touchable = UNSAFE_getByType(TouchableOpacity);
        eixos = [expectAltura44(flat(touchable.props.style))];
        unmount();
      });
      return { categoriaMedida: 'meets-min-one-axis', eixos };
    },
  },

  'KCCard.tsx::KCCard#1': {
    category: 'no-explicit-geometry',
    reason:
      'Container genérico para conteúdo arbitrário (padding:18, sem height/minHeight) — usado ' +
      'por AlertCard/MetricCard/dashboards inteiros; travar uma altura mínima aqui regrediria ' +
      'todo card cujo conteúdo já é naturalmente menor ou maior que 44px, sem ganho real de ' +
      'acessibilidade (o card inteiro já é clicável, geralmente bem maior que 44px em uso real).',
    verify: () => {
      const { UNSAFE_getByType } = wrap(
        <KCCard onPress={() => {}}>
          <Text>conteúdo</Text>
        </KCCard>,
      );
      return expectSemGeometriaExplicita(flat(UNSAFE_getByType(TouchableOpacity).props.style));
    },
  },

  'KCChip.tsx::KCChip#1': {
    category: 'meets-min',
    verify: () => {
      const { UNSAFE_getByType } = wrap(<KCChip onPress={() => {}}>Chip</KCChip>);
      const touchable = UNSAFE_getByType(TouchableOpacity);
      const estilo = flat(touchable.props.style);
      const eixos: EixoProvado[] = [expectAltura44(estilo), expectLargura44(estilo)];
      return { categoriaMedida: 'meets-min', eixos };
    },
  },

  'KCTextField.tsx::KCTextField#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão de mostrar/ocultar senha (`eyeButton`) só declara `paddingLeft: 8` — sem height/' +
      'minHeight/width/minWidth. Gap real de acessibilidade (ícone de texto ~16px + 8px de ' +
      'padding de um lado só, bem abaixo de 44px), não corrigido nesta task (fora dos 4 itens ' +
      'do Escopo 3 do brief) — candidato a follow-up.',
    verify: () => {
      const { getByTestId } = wrap(
        <KCTextField label="Senha" value="" onChangeText={() => {}} secureTextEntry />,
      );
      return expectSemGeometriaExplicita(flat(getByTestId('password-toggle').props.style));
    },
  },

  'AppHeader.tsx::AppHeader#1': {
    category: 'meets-min',
    verify: () => {
      const { getByTestId } = wrap(<AppHeader title="X" onMenuPress={() => {}} />);
      const estilo = flat(getByTestId('app-header-menu').props.style);
      const eixos: EixoProvado[] = [expectAltura44(estilo), expectLargura44(estilo)];
      return { categoriaMedida: 'meets-min', eixos };
    },
  },

  'AppHeader.tsx::AppHeader#2': {
    category: 'meets-min',
    verify: () => {
      const { getByTestId } = wrap(<AppHeader title="X" onMenuPress={() => {}} />);
      const estilo = flat(getByTestId('app-header-search').props.style);
      const eixos: EixoProvado[] = [expectAltura44(estilo), expectLargura44(estilo)];
      return { categoriaMedida: 'meets-min', eixos };
    },
  },

  'NavDrawer.tsx::NavDrawerItem#1': {
    category: 'no-explicit-geometry',
    reason:
      'navItem só declara paddingVertical:14/paddingHorizontal:20/gap:14 — sem height/' +
      'minHeight. Provavelmente >= 44px na prática (padding sozinho já soma 28px + ícone 20px ' +
      '+ texto), mas este ambiente de teste não computa layout Yoga (v11 do brief) — não é ' +
      'afirmado como conforme sem prova.',
    verify: () => {
      const { getByTestId } = renderNavDrawerComUsuario();
      return expectSemGeometriaExplicita(flat(getByTestId('nav-item-dashboard').props.style));
    },
  },

  'NavDrawer.tsx::NavDrawer#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão de logout (`nav-drawer-logout`) não declara ESTILO NENHUM de geometria — nem ' +
      'padding, nem height/minHeight. É o pior caso descoberto por esta varredura (ícone 20×20 ' +
      'sozinho, sem margem de toque nenhuma). Não corrigido nesta task (fora dos 4 itens do ' +
      'Escopo 3 do brief) — candidato de maior prioridade a um follow-up.',
    verify: () => {
      const { getByTestId } = renderNavDrawerComUsuario();
      return expectSemGeometriaExplicita(flat(getByTestId('nav-drawer-logout').props.style));
    },
  },

  'LunaSuggestionBadge.tsx::LunaSuggestionBadge#1': {
    category: 'no-explicit-geometry',
    reason:
      'style inline `{ alignSelf: "flex-end", marginBottom: 4 }` — sem height/minHeight/width/' +
      'minWidth. O `KCChip` interno (não interativo aqui — o `onPress` está no wrapper externo, ' +
      'não no KCChip) não herda `styles.interactive` porque não recebe `onPress` próprio.',
    verify: () => {
      const { getByTestId } = wrap(
        <LunaSuggestionBadge campo="S" idPet={1} onSugest={() => {}} />,
      );
      return expectSemGeometriaExplicita(flat(getByTestId('luna-badge-S').props.style));
    },
  },

  'PetListItem.tsx::PetListItem#1': {
    category: 'no-explicit-geometry',
    reason:
      'styles.row só declara paddingVertical:12/paddingHorizontal:16 — sem height/minHeight. Na ' +
      'prática quase certamente >= 44px (o KCPetPortrait interno sozinho já é 52px), mas este ' +
      'ambiente de teste não computa layout Yoga (v11) — não é afirmado como conforme sem prova.',
    verify: () => {
      const { getByRole } = wrap(<PetListItem pet={PET_FIXTURE} onPress={() => {}} />);
      return expectSemGeometriaExplicita(flat(getByRole('button').props.style));
    },
  },

  'TimelineItem.tsx::TimelineItem#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão "Ver mais"/"Ver menos" (`expand-toggle`) não recebe NENHUM `style` — TouchableOpacity ' +
      'sem padding nem geometria, só o texto (fontSize 12) como área de toque. Gap real de ' +
      'acessibilidade, não corrigido nesta task (fora dos 4 itens do Escopo 3 do brief) — ' +
      'candidato a follow-up.',
    verify: () => {
      const { getByTestId } = wrap(<TimelineItem evento={TIMELINE_EVENTO_FIXTURE} />);
      return expectSemGeometriaExplicita(flat(getByTestId('expand-toggle').props.style));
    },
  },

  'WhatsAppModal.tsx::WhatsAppModal#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão de fechar (`btn-fechar-whatsapp`) só declara `{ padding: 4 }` inline — sem height/' +
      'minHeight/width/minWidth. Ícone 20px + 4px de padding de cada lado ≈ 28px, abaixo de ' +
      '44px. Não corrigido nesta task (fora dos 4 itens do Escopo 3 do brief) — candidato a ' +
      'follow-up.',
    verify: () => {
      const { getByTestId } = wrap(
        <WhatsAppModal
          visible
          onClose={() => {}}
          nmPet="Thor"
          nmTutor="Carlos"
          dsTelefone="11999990001"
          tipo="receituario"
        />,
      );
      return expectSemGeometriaExplicita(flat(getByTestId('btn-fechar-whatsapp').props.style));
    },
  },

  // FM-04: mesmo padrão do WhatsAppModal acima — outro sheet modal com botão
  // de fechar. `useAtualizarStatusAgendamento` (usado internamente pelo
  // componente) é mockado pelo `jest.mock('@hooks/useAgenda', ...)` deste
  // arquivo (ver acima).
  'AgendamentoStatusMenu.tsx::AgendamentoStatusMenu#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão de fechar (`btn-fechar-status-menu`) só declara `{ padding: 4 }` inline — sem ' +
      'height/minHeight/width/minWidth. Ícone 20px + 4px de padding de cada lado ≈ 28px, ' +
      'abaixo de 44px. Mesmo padrão de WhatsAppModal.tsx::WhatsAppModal#1 (não corrigido lá ' +
      'também) — candidato a follow-up conjunto.',
    verify: () => {
      const { getByTestId } = wrap(
        <AgendamentoStatusMenu
          visible
          onClose={() => {}}
          idAgendamento={1}
          nrVersion={1}
          dsStatusOrigem="AGENDADO"
          nmPet="Thor"
        />,
      );
      return expectSemGeometriaExplicita(flat(getByTestId('btn-fechar-status-menu').props.style));
    },
  },

  // --- Fix wave 2b (achado 2 da G2) — 14 entradas de `src/app/`, antes
  // INTEIRAMENTE fora da varredura (`tests/touch-target-coverage.test.ts`
  // não incluía `src/app` em `DIRS`). Ordem: mesma ordem de descoberta por
  // AST (arquivo, depois ordem de aparição no arquivo). ---

  '(app)/agenda.tsx::AgendaAppointmentCard#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão "Teleconsulta" (`btn-iniciar-teleconsulta`) — `teleBtn` só declara ' +
      'paddingVertical:4/paddingHorizontal:8/borderRadius:8 — sem height/minHeight/width/' +
      'minWidth. Não corrigido nesta task (fora do escopo declarado da fix wave 2b, só ' +
      'descoberta) — candidato a follow-up.',
    verify: () => {
      mockUseAgendaSemanaReturn.mockReturnValue({
        data: [AGENDAMENTO_FIXTURE],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        semanaStart: new Date(),
        semanaEnd: new Date(),
      });
      const { getByTestId } = wrap(<AgendaScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId('btn-iniciar-teleconsulta').props.style));
    },
  },

  // FM-04: botão "Status" novo (`btn-status-menu-{id}`), segundo tocável de
  // AgendaAppointmentCard (aparece depois do teleBtn no JSX, dentro do MESMO
  // actionsRow). Mesma limitação de geometria do teleBtn ao lado.
  '(app)/agenda.tsx::AgendaAppointmentCard#2': {
    category: 'no-explicit-geometry',
    reason:
      'Botão "Status" (`btn-status-menu-{id}`) — `statusBtn` só declara paddingVertical:4/' +
      'paddingHorizontal:8/borderRadius:8/borderWidth:1 — sem height/minHeight/width/' +
      'minWidth, mesmo padrão do teleBtn vizinho (AgendaAppointmentCard#1). Não corrigido ' +
      'nesta task (FM-04, fora do escopo declarado) — candidato a follow-up.',
    verify: () => {
      mockUseAgendaSemanaReturn.mockReturnValue({
        data: [AGENDAMENTO_FIXTURE],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        semanaStart: new Date(),
        semanaEnd: new Date(),
      });
      const { getByTestId } = wrap(<AgendaScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId(`btn-status-menu-${AGENDAMENTO_FIXTURE.id}`).props.style));
    },
  },

  '(app)/agenda.tsx::AgendaScreen#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão "semana anterior" (`btn-prev-week`) — `navBtn: { padding: 4 }`, sem height/' +
      'minHeight/width/minWidth explícitos. Violação REAL conhecida (ícone 20px + padding 4px ' +
      'de cada lado ≈ 28px, abaixo de 44px), mas SEM geometria explícita no estilo — este ' +
      'ambiente de teste não computa layout Yoga, então não é afirmado como conforme NEM como ' +
      'violação por render (só por leitura). Tela que entra na demonstração. Não corrigido ' +
      'nesta task (fora do escopo declarado da fix wave 2b) — candidato a follow-up.',
    verify: () => {
      mockUseAgendaSemanaReturn.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        semanaStart: new Date(),
        semanaEnd: new Date(),
      });
      const { getByTestId } = wrap(<AgendaScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId('btn-prev-week').props.style));
    },
  },

  '(app)/agenda.tsx::AgendaScreen#2': {
    category: 'no-explicit-geometry',
    reason:
      'Botão "próxima semana" (`btn-next-week`) — mesmo `navBtn: { padding: 4 }` do botão ' +
      'anterior (mesma violação real, mesma limitação de verificação sem Yoga). Não corrigido ' +
      'nesta task — candidato a follow-up.',
    verify: () => {
      mockUseAgendaSemanaReturn.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        semanaStart: new Date(),
        semanaEnd: new Date(),
      });
      const { getByTestId } = wrap(<AgendaScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId('btn-next-week').props.style));
    },
  },

  '(app)/agenda.tsx::AgendaScreen#3': {
    category: 'meets-min',
    verify: () => {
      mockUseAgendaSemanaReturn.mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        semanaStart: new Date(),
        semanaEnd: new Date(),
      });
      const { getByTestId } = wrap(<AgendaScreen />);
      // Fix wave 3 (achado I-1 da G2 rodada 2): `dayTab` antes só declarava
      // `minWidth: 44` — só o eixo largura era explícito, e esta entrada
      // continuava rotulada `meets-min` (WCAG 2.5.5 = 44×44, os DOIS eixos)
      // sem nunca ter provado altura. O componente foi corrigido
      // (`agenda.tsx::dayTab`, `minHeight: 44` adicionado) em vez de
      // rebaixar a categoria — ganho real de conformidade, barato, sem
      // risco de quebra de layout (mesma decisão que NÃO se aplica ao
      // `KCButton`, ver `meets-min-one-axis` acima). Os dois eixos agora
      // são provados de verdade.
      const estilo = flat(getByTestId('day-tab-0').props.style);
      const eixos: EixoProvado[] = [expectAltura44(estilo), expectLargura44(estilo)];
      return { categoriaMedida: 'meets-min', eixos };
    },
  },

  '(app)/pacientes/[id].tsx::TimelineItemRow#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão "Ver mais"/"Ver menos" do item de timeline não recebe NENHUM `style` — mesmo gap ' +
      'já catalogado em `TimelineItem.tsx::TimelineItem#1` (componente irmão, mesmo padrão de ' +
      'UI), aqui na variante inline da tela de detalhe do paciente. Não corrigido nesta task — ' +
      'candidato a follow-up.',
    verify: () => {
      mockUsePetDetailReturn.mockReturnValue({ data: PET_FIXTURE, isLoading: false, isError: false });
      mockUsePetTimelineReturn.mockReturnValue({ data: [TIMELINE_EVENTO_FIXTURE], isLoading: false });
      const { UNSAFE_getAllByType } = wrap(<PacienteDetailScreen />);
      // A tela inteira tem VÁRIOS `TouchableOpacity` (botões de ação,
      // copy-phone, abas) — sem testID neste, isola pelo filho `<Text>`
      // "Ver mais" em vez de arriscar semântica incerta de `.parent` sobre
      // a árvore host renderizada (TouchableOpacity é componente composto,
      // não host).
      const toggle = UNSAFE_getAllByType(TouchableOpacity).find((el) => {
        const child = el.props.children as React.ReactElement | undefined;
        return (
          React.isValidElement(child) &&
          (child.props as { children?: unknown }).children === 'Ver mais'
        );
      });
      return expectSemGeometriaExplicita(flat(toggle!.props.style));
    },
  },

  '(app)/pacientes/[id].tsx::PacienteDetailScreen#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão de copiar telefone do tutor (`copy-phone-{id}`) não recebe NENHUM `style` — sem ' +
      'height/minHeight/width/minWidth, só o conteúdo interno (ícone 14px + texto) como área ' +
      'de toque. Não corrigido nesta task — candidato a follow-up.',
    verify: () => {
      mockUsePetDetailReturn.mockReturnValue({ data: PET_FIXTURE, isLoading: false, isError: false });
      mockUsePetTimelineReturn.mockReturnValue({ data: [], isLoading: false });
      const { getByTestId } = wrap(<PacienteDetailScreen />);
      return expectSemGeometriaExplicita(
        flat(getByTestId(`copy-phone-${PET_FIXTURE.tutores[0]!.id}`).props.style),
      );
    },
  },

  '(app)/pacientes/[id].tsx::PacienteDetailScreen#2': {
    category: 'no-explicit-geometry',
    reason:
      'Abas Timeline/Vacinas/Docs (`tab-{key}`) — `styles.tab: { flex:1, paddingVertical:12, ' +
      'alignItems:"center" }`, sem height/minHeight/width/minWidth. Provavelmente >= 44px na ' +
      'prática (padding + texto), mas sem prova por Yoga real — não afirmado como conforme.',
    verify: () => {
      mockUsePetDetailReturn.mockReturnValue({ data: PET_FIXTURE, isLoading: false, isError: false });
      mockUsePetTimelineReturn.mockReturnValue({ data: [], isLoading: false });
      const { getByTestId } = wrap(<PacienteDetailScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId('tab-timeline').props.style));
    },
  },

  '(app)/pacientes/index.tsx::PacientesScreen#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão de limpar busca (ícone "close", aparece só com texto digitado) não recebe NENHUM ' +
      '`style` — sem height/minHeight/width/minWidth. Um dos 2 tocáveis desta wave totalmente ' +
      'sem `style` (o outro é `register.tsx::RegisterScreen#1`). Não corrigido — follow-up.',
    verify: () => {
      mockUsePetsReturn.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
      const { getByTestId, UNSAFE_getAllByType } = wrap(<PacientesScreen />);
      fireEvent.changeText(getByTestId('search-input'), 'thor');
      // A tela também renderiza o FAB "+ Novo" (`KCButton`, que embrulha o
      // PRÓPRIO `TouchableOpacity` com `testID="btn-novo-paciente"`) — 2
      // `TouchableOpacity` na árvore depois de digitar, então
      // `UNSAFE_getByType` (que exige exatamente 1 match) quebraria aqui.
      // Filtra pelo testID do FAB para isolar o botão de limpar busca, que
      // não tem testID próprio.
      const clearButton = UNSAFE_getAllByType(TouchableOpacity).find(
        (el) => el.props.testID !== 'btn-novo-paciente',
      );
      return expectSemGeometriaExplicita(flat(clearButton!.props.style));
    },
  },

  '(app)/receituario/[idPet].tsx::ReceituarioScreen#1': {
    category: 'no-explicit-geometry',
    reason:
      'Item da lista de medicamentos (`med-item-{id}`) — `medItem: { paddingHorizontal:12, ' +
      'paddingVertical:10, borderTopWidth:1, ... }`, sem height/minHeight/width/minWidth. Não ' +
      'corrigido nesta task — candidato a follow-up.',
    verify: () => {
      mockUseMedicamentosReturn.mockReturnValue({ items: [MEDICAMENTO_FIXTURE] });
      mockUseLocalSearchParams.mockReturnValue({ idPet: '1' });
      const { getByTestId } = wrap(<ReceituarioScreen />);
      fireEvent.changeText(getByTestId('search-med'), 'amox');
      return expectSemGeometriaExplicita(
        flat(getByTestId(`med-item-${MEDICAMENTO_FIXTURE.id}`).props.style),
      );
    },
  },

  '(app)/receituario/[idPet].tsx::ReceituarioScreen#2': {
    category: 'no-explicit-geometry',
    reason:
      'Seletor de data (`date-picker-trigger`) — `dateRow: { ..., borderWidth:1, borderRadius:10, ' +
      'padding:12 }`, sem height/minHeight/width/minWidth. Não corrigido — candidato a follow-up.',
    verify: () => {
      mockUseMedicamentosReturn.mockReturnValue({ items: [] });
      mockUseLocalSearchParams.mockReturnValue({ idPet: '1' });
      const { getByTestId } = wrap(<ReceituarioScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId('date-picker-trigger').props.style));
    },
  },

  // Fix wave 3 (achado I-2 da G2 rodada 2): `Switch` entrou em
  // `INTERACTIVE_TAGS` (`discoverInteractiveTouchables.ts`) — os 2
  // `<Switch>` de `settings.tsx` (`switch-dark-mode` linha ~119,
  // `switch-notif` linha ~140) agora contam como touchables ANTES do
  // `TouchableOpacity` de "Convidar membro" na ordem de aparição no
  // arquivo, então a numeração de `SettingsScreen#n` inteira deslocou:
  // o que era `#1` (btn-convidar) virou `#3`.
  '(app)/settings.tsx::SettingsScreen#1': {
    category: 'no-explicit-geometry',
    reason:
      'Switch "Modo escuro" (`switch-dark-mode`) não recebe `style` nenhum — medido por render ' +
      'real: o estilo achatado do nó nativo é `{alignSelf:"flex-start"}`, sem height/minHeight/' +
      'width/minWidth (o RN não expõe geometria de `Switch` de forma útil via `style`; o ' +
      'tamanho visual vem do nativo, fora do que este walker consegue provar sem Yoga real). ' +
      'Não corrigido nesta task — candidato a follow-up.',
    verify: () => {
      const { getByTestId } = wrap(<SettingsScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId('switch-dark-mode').props.style));
    },
  },

  '(app)/settings.tsx::SettingsScreen#2': {
    category: 'no-explicit-geometry',
    reason:
      'Switch "Notificações push" (`switch-notif`) — mesmo caso do `switch-dark-mode` acima ' +
      '(sem `style`, mesmo estilo nativo achatado sem height/width explícitos). Não corrigido ' +
      'nesta task — candidato a follow-up.',
    verify: () => {
      const { getByTestId } = wrap(<SettingsScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId('switch-notif').props.style));
    },
  },

  '(app)/settings.tsx::SettingsScreen#3': {
    category: 'no-explicit-geometry',
    reason:
      'Botão "Convidar membro" (`btn-convidar`) — `inviteRow: { flexDirection:"row", ' +
      'alignItems:"center", gap:6, paddingVertical:6 }`, sem height/minHeight/width/minWidth. ' +
      'Mesmo padrão de "funcionalidade em breve" de `pacientes/index.tsx::PacientesScreen#1`. ' +
      'Não corrigido — candidato a follow-up.',
    verify: () => {
      // FM-01 — mesma razao do `renderNavDrawerComUsuario`: a secao "Time"
      // (que contem `btn-convidar`) passou a gatear em `email` em vez de
      // `usuario`, porque gerenciar a equipe e justamente funcao de GESTOR e
      // um gestor sem ficha era quem MAIS perdia acesso a ela.
      useAuthStore.setState({
        token: 'tok',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        email: 'f@k.com',
        tpPerfil: 'VETERINARIO',
        usuario: { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345', dsEmail: 'f@k.com' },
      });
      const { getByTestId } = wrap(<SettingsScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId('btn-convidar').props.style));
    },
  },

  'login.tsx::LoginScreen#1': {
    category: 'no-explicit-geometry',
    reason:
      'Link "Cadastrar clínica" (`login-register-link`) — `registerLink: { alignItems:"center", ' +
      'marginTop:16 }`, sem height/minHeight/width/minWidth. Não corrigido — candidato a follow-up.',
    verify: () => {
      useAuthStore.setState({ token: null, expiresAt: null, usuario: null });
      const { getByTestId } = wrapWithQuery(<LoginScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId('login-register-link').props.style));
    },
  },

  'register.tsx::RegisterScreen#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão de voltar (`register-back`) não recebe NENHUM `style` — sem height/minHeight/width/' +
      'minWidth, só o ícone (22px) como área de toque. Um dos 2 tocáveis desta wave totalmente ' +
      'sem `style` (o outro é `pacientes/index.tsx::PacientesScreen#1`). Não corrigido — follow-up.',
    verify: () => {
      useAuthStore.setState({ token: null, expiresAt: null, usuario: null });
      const { getByTestId } = wrapWithQuery(<RegisterScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId('register-back').props.style));
    },
  },

  'register.tsx::RegisterScreen#2': {
    category: 'no-explicit-geometry',
    reason:
      'Link "Já tenho conta" (`register-go-login`) — `loginLink: { alignItems:"center", ' +
      'marginTop:16, marginBottom:8 }`, sem height/minHeight/width/minWidth. Não corrigido — ' +
      'candidato a follow-up.',
    verify: () => {
      useAuthStore.setState({ token: null, expiresAt: null, usuario: null });
      const { getByTestId } = wrapWithQuery(<RegisterScreen />);
      return expectSemGeometriaExplicita(flat(getByTestId('register-go-login').props.style));
    },
  },

  // --- CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — 4 entradas novas:
  // 1 em KCEmptyState.tsx (primitiva, item 1 do escopo), 2 em
  // OnboardingChecklist.tsx (× e passo, item 2), 1 em settings.tsx
  // ("Rever primeiros passos", item 4). Os 3 componentes/telas continuam
  // fora deste registry ANTES desta task porque nenhum tinha tocável (o
  // `KCEmptyState` não existia; `OnboardingChecklist` não existia;
  // `dashboard.tsx`/`agenda.tsx`/`luna.tsx`/`pacientes/*.tsx` não ganharam
  // tocável NOVO — só trocaram `<Text>` por `<KCEmptyState>`, uma tag de
  // componente customizado, invisível ao walker por desenho — só
  // `settings.tsx` ganhou um `TouchableOpacity` a mais). ---

  'KCEmptyState.tsx::KCEmptyState#1': {
    category: 'meets-min',
    verify: () => {
      const { getByTestId } = wrap(
        <KCEmptyState
          icon="agenda"
          title="Título de teste"
          description="Descrição de teste"
          action={{ label: 'Ver agenda', href: ROUTES.app.agenda }}
          testID="empty-test"
        />,
      );
      const estilo = flat(getByTestId('empty-test-action').props.style);
      const eixos: EixoProvado[] = [expectAltura44(estilo), expectLargura44(estilo)];
      return { categoriaMedida: 'meets-min', eixos };
    },
  },

  'OnboardingChecklist.tsx::OnboardingChecklist#1': {
    category: 'meets-min',
    verify: () => {
      useOnboardingStore.setState({ completedSteps: [], dismissed: false, _hasHydrated: true });
      const { getByTestId } = wrap(<OnboardingChecklist />);
      const estilo = flat(getByTestId('onboarding-dismiss').props.style);
      const eixos: EixoProvado[] = [expectAltura44(estilo), expectLargura44(estilo)];
      return { categoriaMedida: 'meets-min', eixos };
    },
  },

  'OnboardingChecklist.tsx::OnboardingChecklist#2': {
    category: 'meets-min',
    verify: () => {
      useOnboardingStore.setState({ completedSteps: [], dismissed: false, _hasHydrated: true });
      const { getByTestId } = wrap(<OnboardingChecklist />);
      // 1 ocorrência sintática no arquivo (dentro de `STEPS.map(...)`)
      // corresponde a 4 instâncias em runtime — mede a primeira, mesmo
      // estilo (`styles.step`) compartilhado pelas 4.
      const estilo = flat(getByTestId('onboarding-step-agenda').props.style);
      const eixos: EixoProvado[] = [expectAltura44(estilo), expectLargura44(estilo)];
      return { categoriaMedida: 'meets-min', eixos };
    },
  },

  '(app)/settings.tsx::SettingsScreen#4': {
    category: 'meets-min',
    verify: () => {
      useAuthStore.setState({
        token: 'tok',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        usuario: { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345', dsEmail: 'f@k.com' },
      });
      const { getByTestId } = wrap(<SettingsScreen />);
      const estilo = flat(getByTestId('btn-rever-onboarding').props.style);
      const eixos: EixoProvado[] = [expectAltura44(estilo), expectLargura44(estilo)];
      return { categoriaMedida: 'meets-min', eixos };
    },
  },
};
