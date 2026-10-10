import React from 'react';
import { Redirect, usePathname, useRouter, type Href } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useAuthStore } from '@store/authStore';
import { useOnboardingStore, type OnboardingStepId } from '@store/onboardingStore';
import { useBreakpoint } from '@hooks/useBreakpoint';
import type { BreakpointKey } from '@theme/tokens';
import { NavDrawer } from '@components/layout/NavDrawer';
import { AppHeader } from '@components/layout/AppHeader';
import { ROUTES } from '@constants/routes';
import { STRINGS } from '@constants/strings';

// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — item 2: "como um passo é
// marcado como concluído" (decisão do Felipe, brief da task): AUTOMÁTICO,
// quando o usuário visita a rota correspondente — nunca checkbox manual.
// Observado num ÚNICO PONTO (`usePathname()` aqui), não espalhado em
// `useEffect` por 4 telas — é o que faz o checklist ser de ATIVAÇÃO, não
// decoração. Mapa derivado de `ROUTES.app` (nunca duplicado à mão em
// paralelo) para não poder divergir de rota sem quebrar em `tsc` se um dia
// `ROUTES.app.agenda` mudar de valor.
const ONBOARDING_ROUTE_STEP: Partial<Record<string, OnboardingStepId>> = {
  [ROUTES.app.agenda]: 'agenda',
  [ROUTES.app.pacientes]: 'pacientes',
  [ROUTES.app.luna]: 'luna',
  [ROUTES.app.settings]: 'settings',
};

function useTrackOnboardingStepVisits() {
  const pathname = usePathname();
  const markStepCompleted = useOnboardingStore((s) => s.markStepCompleted);

  React.useEffect(() => {
    const step = ONBOARDING_ROUTE_STEP[pathname];
    if (step) markStepCompleted(step);
  }, [pathname, markStepCompleted]);
}

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

// BR-CLI-T05 (C3, fecha o E27): telas de AÇÃO/DETALHE do paciente ganham cabeçalho com "Voltar" 44px.
// Antes herdavam `headerShown: false` e só saíam pelo botão físico/gesto — no web, sem saída nenhuma.
// `router.back()` quando existe histórico; sem histórico (acesso direto por URL) vai para a lista
// certa: a ficha volta para Pacientes, as demais voltam para a ficha do pet da própria rota.
export function destinoSemHistorico(rota: 'ficha' | 'idPet', params?: { idPet?: string }): Href {
  if (rota === 'idPet') {
    const id = Number(params?.idPet);
    return Number.isFinite(id) && id > 0 ? ROUTES.app.pacienteDetalhe(id) : ROUTES.app.dashboard;
  }
  return ROUTES.app.pacientes;
}

interface TelaComVoltar {
  nome: string;
  titulo: string;
  destino: 'ficha' | 'idPet';
}

const TELAS_COM_VOLTAR: TelaComVoltar[] = [
  { nome: 'pacientes/[id]', titulo: STRINGS.saida.ficha, destino: 'ficha' },
  { nome: 'consulta/[idPet]', titulo: STRINGS.saida.consulta, destino: 'idPet' },
  { nome: 'receituario/[idPet]', titulo: STRINGS.saida.receituario, destino: 'idPet' },
  { nome: 'teleorientacao/[idPet]', titulo: STRINGS.saida.teleorientacao, destino: 'idPet' },
];

function HeaderComVoltar({
  titulo,
  destino,
  params,
}: {
  titulo: string;
  destino: 'ficha' | 'idPet';
  params?: { idPet?: string };
}) {
  const router = useRouter();
  const voltar = () => {
    if (router.canGoBack()) router.back();
    else router.replace(destinoSemHistorico(destino, params));
  };
  return <AppHeader title={titulo} onMenuPress={() => undefined} onBackPress={voltar} />;
}

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  const { isAtLeast } = useBreakpoint();
  // Regra dos hooks: chamado incondicionalmente, ANTES do `return` antecipado
  // de não-autenticado abaixo — mesmo padrão já usado por `KCCard`
  // (`webInteraction`, ver comentário CQ-08 em KCCard.tsx).
  useTrackOnboardingStepVisits();

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
      // BR-CLI-T05 (G2 I-1): o padrão do Drawer é `firstRoute` — `canGoBack()` fica verdadeiro em qualquer rota
      // que não seja a primeira e `back()` cai SEMPRE na Hoje (medido no web: lista→ficha→consulta→Voltar = /dashboard).
      // `history` faz o Voltar desfazer a navegação de verdade; sem histórico (URL direta) o `canGoBack()` é falso
      // e o fallback `destinoSemHistorico` leva à tela-pai.
      backBehavior="history"
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
      {TELAS_COM_VOLTAR.map((t) => (
        <Drawer.Screen
          key={t.nome}
          name={t.nome}
          options={{
            headerShown: true,
            header: ({ route }) => (
              <HeaderComVoltar
                titulo={t.titulo}
                destino={t.destino}
                params={route?.params as { idPet?: string } | undefined}
              />
            ),
          }}
        />
      ))}
    </Drawer>
  );
}
