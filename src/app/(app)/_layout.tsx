import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useAuthStore } from '@store/authStore';
import { useBreakpoint } from '@hooks/useBreakpoint';
import type { BreakpointKey } from '@theme/tokens';
import { NavDrawer } from '@components/layout/NavDrawer';
import { AppHeader } from '@components/layout/AppHeader';
import { STRINGS } from '@constants/strings';

// CQ-05 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — shell adaptativo: em
// desktop o drawer overlay é o padrão errado, porque esconde a navegação
// (5 itens, cabe na tela) atrás de um toque. Exportada como função pura
// (mesmo padrão de `metricsColumnsFor`/`listColumnsFor` em dashboard.tsx —
// CQ-06) para ser testável sem montar a árvore do Drawer inteira. O
// argumento do corte `>= lg` e a ressalva sobre a faixa `md` (tablet
// retrato, decisão de produto não tomada por esta task) estão documentados
// em `breakpoints` (src/theme/tokens.ts) — nunca duplicar o número aqui.
export function resolveDrawerType(isAtLeast: (key: BreakpointKey) => boolean): 'permanent' | 'front' {
  return isAtLeast('lg') ? 'permanent' : 'front';
}

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  const { isAtLeast } = useBreakpoint();

  if (!isAuthenticated()) {
    return <Redirect href="/login" />;
  }

  const drawerType = resolveDrawerType(isAtLeast);
  // Botão de menu só faz sentido quando o drawer é overlay — com sidebar
  // permanente ele já está sempre visível, então o botão abriria o que já
  // está aberto.
  const showMenuButton = drawerType !== 'permanent';

  return (
    <Drawer
      drawerContent={(props) => <NavDrawer {...props} />}
      screenOptions={{ headerShown: false, drawerType }}
    >
      <Drawer.Screen
        name="dashboard"
        options={{
          headerShown: true,
          header: ({ navigation }) => (
            <AppHeader
              title={STRINGS.dashboard.titulo}
              onMenuPress={() => navigation.toggleDrawer()}
              showMenuButton={showMenuButton}
            />
          ),
        }}
      />
      <Drawer.Screen
        name="agenda"
        options={{
          headerShown: true,
          header: ({ navigation }) => (
            <AppHeader
              title="Agenda"
              onMenuPress={() => navigation.toggleDrawer()}
              showMenuButton={showMenuButton}
            />
          ),
        }}
      />
      <Drawer.Screen
        // Fix wave pós-G2 (item 1): o nome REAL da rota, segundo o
        // expo-router (`getMockConfig('src/app')`), é "pacientes/index" —
        // não há `_layout.tsx` dentro de `src/app/(app)/pacientes/`, então
        // o router não colapsa o nome do arquivo. `name="pacientes"`
        // (valor anterior, pré-existente desde `main`) não casa com
        // nenhuma rota registrada: o expo-router descarta as `options`
        // deste `Drawer.Screen` inteiras (node_modules/expo-router/build/
        // useScreens.js:69-71) e a tela real entra com `props: {}` — sem
        // `header`, sem `showMenuButton`. Efeito real, medido pela G2: a
        // tela de Pacientes rodava sem `AppHeader`, e o realce do item
        // "Pacientes" em NavDrawer.tsx nunca acendia (state.routes[].name
        // é "pacientes/index", nunca "pacientes"). Ver
        // tests/AppLayoutSidebar.routeNames.test.tsx.
        name="pacientes/index"
        options={{
          headerShown: true,
          header: ({ navigation }) => (
            <AppHeader
              title={STRINGS.pacientes.titulo}
              onMenuPress={() => navigation.toggleDrawer()}
              showMenuButton={showMenuButton}
            />
          ),
        }}
      />
      <Drawer.Screen
        name="luna"
        options={{
          headerShown: true,
          header: ({ navigation }) => (
            <AppHeader
              title={STRINGS.luna.titulo}
              onMenuPress={() => navigation.toggleDrawer()}
              showMenuButton={showMenuButton}
            />
          ),
        }}
      />
      <Drawer.Screen
        name="settings"
        options={{
          headerShown: true,
          header: ({ navigation }) => (
            <AppHeader
              title={STRINGS.configuracoes.titulo}
              onMenuPress={() => navigation.toggleDrawer()}
              showMenuButton={showMenuButton}
            />
          ),
        }}
      />
    </Drawer>
  );
}
