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
import React from 'react';
import { render } from '@testing-library/react-native';
import { StyleSheet, TouchableOpacity, Text } from 'react-native';
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
import type { PetResponse, TimelineEventResponse } from '../src/types/api';

// --- Mocks compartilhados — só o necessário pra renderizar AppHeader/
// NavDrawer/WhatsAppModal fora do app real. Padrões copiados dos testes que
// já existem pra cada componente (AppHeader.test.tsx, NavDrawer.test.tsx,
// WhatsAppModal.test.tsx), não inventados aqui. ---

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const ReactForMock = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
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
jest.mock('@hooks/useEventosClinicos', () => ({
  useEnviarWhatsApp: () => ({ mutate: mockMutateWhatsApp, isPending: false }),
}));

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
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
};
