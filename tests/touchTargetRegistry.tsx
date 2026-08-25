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
// 3 categorias, cada uma com um contrato diferente de "razão precisa
// aparecer":
//   - 'meets-min': geometria EXPLÍCITA (height/minHeight E/OU width/minWidth
//     numéricos no estilo achatado) comprovada >= `touchTarget.min` (44px)
//     por render real. `verify()` FALHA se a mutação reduzir a dimensão —
//     é o que dá a mordida.
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
// Fix wave 2b (achado 2 da G2): as 14 entradas de `src/app/` no fim deste
// registry (a partir de `(app)/agenda.tsx::AgendaAppointmentCard#1`) seguem
// o MESMO contrato acima — nenhuma categoria nova, nenhuma exceção. O
// achado da classificação real: nenhuma delas tem geometria EXPLÍCITA
// abaixo de 44px (a suposição inicial do maestro era que esta wave seria o
// primeiro uso real de `allowlisted-below-min`) — 13 são
// `no-explicit-geometry` (inclusive violações REAIS conhecidas, como
// `agenda.tsx::navBtn` — `padding:4` sobre ícone 20px, ≈28px, mas SEM
// height/width explícitos — a categoria captura corretamente "não
// afirmamos conformidade", não "está conforme") e 1
// (`AgendaScreen#3`/`day-tab`) é `meets-min` por `minWidth:44` explícito,
// exatamente no piso. Ver `src/a11y/discoverInteractiveTouchables.ts`
// (bloco "Limitação de verificação") e task-CQ-08-report.md, seção
// "Fix wave 2b", para o detalhe completo.
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
jest.mock('@hooks/useAgenda', () => ({ useAgendaSemana: () => mockUseAgendaSemanaReturn() }));

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

function expectAltura44(estilo: Record<string, unknown>) {
  const altura = maiorDeclarado(estilo, 'height', 'minHeight');
  expect(altura).toBeDefined();
  expect(altura as number).toBeGreaterThanOrEqual(touchTarget.min);
}

function expectLargura44(estilo: Record<string, unknown>) {
  const largura = maiorDeclarado(estilo, 'width', 'minWidth');
  expect(largura).toBeDefined();
  expect(largura as number).toBeGreaterThanOrEqual(touchTarget.min);
}

function expectSemGeometriaExplicita(estilo: Record<string, unknown>) {
  expect(maiorDeclarado(estilo, 'height', 'minHeight')).toBeUndefined();
  expect(maiorDeclarado(estilo, 'width', 'minWidth')).toBeUndefined();
}

export type TouchTargetCategory = 'meets-min' | 'allowlisted-below-min' | 'no-explicit-geometry';

export interface TouchTargetRegistryEntry {
  category: TouchTargetCategory;
  /** Obrigatório para as 2 categorias que não são 'meets-min' — checado à
   *  parte pelo teste de "toda entrada não-conforme carrega razão". */
  reason?: string;
  /** Renderiza o componente real e faz as asserções — nunca decorativo:
   *  mutar a fonte (ex.: baixar um `height`) FAZ este `verify()` falhar. */
  verify: () => void;
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
  useAuthStore.setState({
    token: 'tok',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
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
    category: 'meets-min',
    verify: () => {
      (['sm', 'md', 'lg'] as const).forEach((size) => {
        const { UNSAFE_getByType, unmount } = wrap(<KCButton size={size}>Texto</KCButton>);
        const touchable = UNSAFE_getByType(TouchableOpacity);
        expectAltura44(flat(touchable.props.style));
        unmount();
      });
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
      expectSemGeometriaExplicita(flat(UNSAFE_getByType(TouchableOpacity).props.style));
    },
  },

  'KCChip.tsx::KCChip#1': {
    category: 'meets-min',
    verify: () => {
      const { UNSAFE_getByType } = wrap(<KCChip onPress={() => {}}>Chip</KCChip>);
      const touchable = UNSAFE_getByType(TouchableOpacity);
      const estilo = flat(touchable.props.style);
      expectAltura44(estilo);
      expectLargura44(estilo);
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
      expectSemGeometriaExplicita(flat(getByTestId('password-toggle').props.style));
    },
  },

  'AppHeader.tsx::AppHeader#1': {
    category: 'meets-min',
    verify: () => {
      const { getByTestId } = wrap(<AppHeader title="X" onMenuPress={() => {}} />);
      expectAltura44(flat(getByTestId('app-header-menu').props.style));
      expectLargura44(flat(getByTestId('app-header-menu').props.style));
    },
  },

  'AppHeader.tsx::AppHeader#2': {
    category: 'meets-min',
    verify: () => {
      const { getByTestId } = wrap(<AppHeader title="X" onMenuPress={() => {}} />);
      expectAltura44(flat(getByTestId('app-header-search').props.style));
      expectLargura44(flat(getByTestId('app-header-search').props.style));
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
      expectSemGeometriaExplicita(flat(getByTestId('nav-item-dashboard').props.style));
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
      expectSemGeometriaExplicita(flat(getByTestId('nav-drawer-logout').props.style));
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
      expectSemGeometriaExplicita(flat(getByTestId('luna-badge-S').props.style));
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
      expectSemGeometriaExplicita(flat(getByRole('button').props.style));
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
      expectSemGeometriaExplicita(flat(getByTestId('expand-toggle').props.style));
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
      expectSemGeometriaExplicita(flat(getByTestId('btn-fechar-whatsapp').props.style));
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
      expectSemGeometriaExplicita(flat(getByTestId('btn-iniciar-teleconsulta').props.style));
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
      expectSemGeometriaExplicita(flat(getByTestId('btn-prev-week').props.style));
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
      expectSemGeometriaExplicita(flat(getByTestId('btn-next-week').props.style));
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
      // `dayTab: { ..., minWidth: 44 }` — só largura é explícita (sem
      // height/minHeight), então só `expectLargura44` é chamado. Mesmo
      // padrão parcial de `KCButton.tsx::KCButton#1` (só altura).
      expectLargura44(flat(getByTestId('day-tab-0').props.style));
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
      expectSemGeometriaExplicita(flat(toggle!.props.style));
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
      expectSemGeometriaExplicita(
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
      expectSemGeometriaExplicita(flat(getByTestId('tab-timeline').props.style));
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
      expectSemGeometriaExplicita(flat(clearButton!.props.style));
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
      expectSemGeometriaExplicita(
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
      expectSemGeometriaExplicita(flat(getByTestId('date-picker-trigger').props.style));
    },
  },

  '(app)/settings.tsx::SettingsScreen#1': {
    category: 'no-explicit-geometry',
    reason:
      'Botão "Convidar membro" (`btn-convidar`) — `inviteRow: { flexDirection:"row", ' +
      'alignItems:"center", gap:6, paddingVertical:6 }`, sem height/minHeight/width/minWidth. ' +
      'Mesmo padrão de "funcionalidade em breve" de `pacientes/index.tsx::PacientesScreen#1`. ' +
      'Não corrigido — candidato a follow-up.',
    verify: () => {
      useAuthStore.setState({
        token: 'tok',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        usuario: { id: 1, nmVeterinario: 'Dr. Felipe', nrCRMV: 'SP-12345', dsEmail: 'f@k.com' },
      });
      const { getByTestId } = wrap(<SettingsScreen />);
      expectSemGeometriaExplicita(flat(getByTestId('btn-convidar').props.style));
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
      expectSemGeometriaExplicita(flat(getByTestId('login-register-link').props.style));
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
      expectSemGeometriaExplicita(flat(getByTestId('register-back').props.style));
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
      expectSemGeometriaExplicita(flat(getByTestId('register-go-login').props.style));
    },
  },
};
