import React, { useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Link } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCIcon } from '@components/primitives/KCIcon';
import type { KCIconName } from '@components/primitives/KCIcon';
import { KuraMark } from '@components/brand/KuraMark';
import { useAuthStore } from '@store/authStore';
import { STRINGS } from '@constants/strings';
import { ROUTES } from '@constants/routes';
import { useWebInteractionState } from '@hooks/useWebInteractionState';
import { getWebInteractionStyle } from '@theme/webInteraction';

// Nomes de tela do navigator do drawer (não são rotas/URL): chaves de
// `ROUTES.app` cujo valor é uma string estática (exclui os helpers de rota
// dinâmica, como `pacienteDetalhe`, que são funções). Cada item do drawer
// precisa de DOIS papéis distintos — ver task CQ-03 (dev VsClaude,
// KURA_BACKLOG_CLINICA_1, M2): `name` alimenta `href` (derivado via
// indexação em `ROUTES.app`, nunca duplicado à mão) para o `<Link>`; o
// realce do item ativo compara contra `routeName ?? name` (ver
// `NavItem.routeName` abaixo — fix wave pós-G2, CQ-05 item 1: `name` e o
// nome real de tela do navigator podem divergir quando o arquivo de rota
// mora numa subpasta com `index.tsx`). Renomear uma tela em `ROUTES.app`
// quebra este arquivo em `tsc`, porque o tipo de `name` deixa de aceitar o
// valor antigo.
type ScreenRouteName = {
  [K in keyof typeof ROUTES.app]: (typeof ROUTES.app)[K] extends string ? K : never;
}[keyof typeof ROUTES.app];

interface NavItem {
  name: ScreenRouteName;
  /**
   * Fix wave pós-G2 da CQ-05 (dev VsClaude, KURA_BACKLOG_CLINICA_1), item 1:
   * nome REGISTRADO pelo expo-router para esta tela (o valor real de
   * `state.routes[].name` em runtime), quando diverge de `name`. Só
   * "pacientes" precisa disso hoje: o arquivo de rota vive em
   * `src/app/(app)/pacientes/index.tsx`, sem `_layout.tsx` dentro da pasta,
   * então o expo-router registra a tela como "pacientes/index" — não
   * "pacientes" (confirmado por `getMockConfig('src/app')`, ver
   * `discoverRealAppRouteNames.ts`). Comparar o realce contra "pacientes"
   * (valor pré-existente até este fix) comparava contra um nome que o
   * navigator nunca produz — o item "Pacientes" nunca acendia. `href`
   * continua vindo de `ROUTES.app[name]` (a URL, não o nome de tela) — as
   * duas coisas divergem de propósito, ver comentário em `routes.ts`.
   * Ausente = igual a `name`.
   */
  routeName?: string;
  icon: KCIconName;
  label: string;
}

// Exportado para o teste de sincronia com `_layout.tsx` (fix wave pós-G2, item
// 2 da CQ-03 — ver `discoverDrawerScreenNames.ts` e
// `tests/NavDrawer.drawerScreenSync.test.ts`): é o lado "o que o drawer
// oferece" do acoplamento com "o que `_layout.tsx` registra como tela". A
// comparação usa `routeName ?? name` (não `name` puro), porque é
// `routeName` — quando presente — que corresponde ao `name=` real do
// `<Drawer.Screen>` em `_layout.tsx`.
export const NAV_ITEMS: NavItem[] = [
  { name: 'dashboard', icon: 'dashboard', label: STRINGS.dashboard.titulo },
  { name: 'agenda', icon: 'agenda', label: 'Agenda' },
  {
    name: 'pacientes',
    routeName: 'pacientes/index',
    icon: 'patients',
    label: STRINGS.pacientes.titulo,
  },
  { name: 'luna', icon: 'luna', label: STRINGS.luna.titulo },
  { name: 'settings', icon: 'settings', label: STRINGS.configuracoes.titulo },
];

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.primary },
    header: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: colors.primarySoft,
      alignItems: 'flex-start',
      gap: 8,
    },
    brandName: {
      fontFamily: 'Cormorant_500Medium',
      fontSize: 28,
      color: colors.textOnPrimary,
    },
    nav: { flex: 1 },
    navContent: { paddingTop: 8, paddingBottom: 8 },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 20,
    },
    navItemActive: { backgroundColor: colors.primarySoft },
    // Repõe o feedback visual de toque que o TouchableOpacity dava de graça
    // (activeOpacity padrão) — Pressable não tem isso embutido, então sem
    // este estilo trocar TouchableOpacity por Pressable seria regressão de
    // UX disfarçada de melhoria técnica (ver armadilha #1 da task CQ-03).
    // 0.2 é o valor real, conferido na fonte do RN nesta versão instalada
    // (node_modules/react-native/Libraries/Components/Touchable/
    // TouchableOpacity.js:247 — `this.props.activeOpacity ?? 0.2`), não 0.6
    // (fix wave pós-G2, item 3 — o valor anterior deixava o item "acender"
    // bem menos que o TouchableOpacity original).
    navItemPressed: { opacity: 0.2 },
    navLabel: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.textOnPrimary,
    },
    navLabelActive: { fontFamily: 'Lexend_500Medium' },
    footer: {
      borderTopWidth: 1,
      borderTopColor: colors.primarySoft,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    userInfo: { flex: 1, marginRight: 12 },
    userName: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 14,
      color: colors.textOnPrimary,
    },
    userCrmv: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textOnPrimary,
      opacity: 0.7,
      marginTop: 2,
    },
  });

// Item de navegação isolado num componente próprio — necessário para poder
// chamar `useState` (feedback de toque) por item, o que não é permitido
// dentro do callback de `.map()` do componente pai (regra dos hooks).
//
// Causa raiz confirmada (task navdrawer-web-layout-fix, dev VsClaude,
// KURA_BACKLOG_CLINICA_1): com `<Link asChild>`, o expo-router troca o
// `Component` por `Slot` (`expo-router/build/ui/Slot.js`, que envolve
// `@radix-ui/react-slot`). O `Slot` do Radix clona o filho único mesclando
// as próprias props com as do filho via `mergeProps`
// (`@radix-ui/react-slot/dist/index.mjs`), e para a prop `style` a mesclagem
// é literalmente `{ ...slotStyle, ...childStyle }` — um spread de objeto
// puro, que assume que `style` é sempre um objeto plano. O `Pressable` daqui
// passava `style` como FUNÇÃO (`({pressed}) => [...]`, a forma idiomática de
// dar feedback de toque); espalhar uma função com `{...fn}` produz `{}` (função
// não tem propriedade própria enumerável por padrão), então o estilo inteiro
// era descartado silenciosamente — sobravam só os defaults do
// react-native-web pra `View` (`flexDirection:'column'`, sem padding), que é
// exatamente o que a medição por CDP mostrou. Um `style` em forma de ARRAY
// (`[styles.navItem, ...]`) sofre o mesmo destino: `{...array}` produz um
// objeto com chaves numéricas (`{0: ..., 1: ...}`), não um array, e o
// react-native-web não reconhece isso como estilo válido. A única forma que
// sobrevive ao `{...a, ...b}` do Radix intacta é um objeto plano já
// achatado — daí `StyleSheet.flatten(...)` aqui, em vez de função ou array.
// O feedback de toque (`navItemPressed`) foi preservado trocando a forma-
// função por estado próprio (`onPressIn`/`onPressOut`), não removido.
function NavDrawerItem({
  item,
  isActive,
  styles,
  colors,
}: {
  item: NavItem;
  isActive: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: typeof lightColors;
}) {
  const [pressed, setPressed] = useState(false);
  // CQ-08: hover/foco visível na web. `getWebInteractionStyle(...)` entra
  // ANTES de `pressed && styles.navItemPressed` no array — `StyleSheet.
  // flatten` resolve por ordem (o último presente vence), e press precisa
  // continuar dominando hover quando os dois coincidem (mouse ainda sobre o
  // item no instante do clique), senão o feedback de toque do CQ-03
  // desapareceria bem na hora do clique.
  const webInteraction = useWebInteractionState();
  // `href` deriva de `item.name` por indexação em ROUTES.app — nunca
  // escrito à mão em paralelo, para não poder divergir do nome de tela sem
  // quebrar em tsc (ver comentário de ScreenRouteName acima).
  const href = ROUTES.app[item.name];
  const itemStyle = StyleSheet.flatten([
    styles.navItem,
    isActive && styles.navItemActive,
    getWebInteractionStyle(webInteraction, colors.textOnPrimary),
    pressed && styles.navItemPressed,
  ]);

  return (
    <Link href={href} asChild>
      <Pressable
        style={itemStyle}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        onMouseEnter={webInteraction.onMouseEnter}
        onMouseLeave={webInteraction.onMouseLeave}
        onFocus={webInteraction.onFocus}
        onBlur={webInteraction.onBlur}
        accessibilityRole="menuitem"
        testID={`nav-item-${item.name}`}
      >
        <KCIcon name={item.icon} size={20} color={colors.textOnPrimary} />
        <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
      </Pressable>
    </Link>
  );
}

export function NavDrawer({ state }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { usuario, clearSession } = useAuthStore();
  const activeRouteName = state.routes[state.index]?.name;
  const logoutInteraction = useWebInteractionState();

  return (
    <View style={styles.container} testID="nav-drawer">
      <SafeAreaView style={styles.header} edges={['top']}>
        {/* Marca canônica em knockout (ruling D-3, dev VsClaude,
            KURA_BACKLOG_CLINICA_1, CQ-12): fundo do header é colors.primary
            (ocean), então a marca precisa de colors.textOnPrimary para não
            violar contraste mínimo 4.5:1. Aposenta o ícone de pata antigo. */}
        <KuraMark size={32} color={colors.textOnPrimary} />
        <Text style={styles.brandName}>{STRINGS.app.name}</Text>
      </SafeAreaView>

      {/* CQ-08 (G2 da CQ-03, achado parqueado): cada item do drawer já
          carregava accessibilityRole="menuitem", mas sem ancestral com role
          "menu"/"menubar" — role órfão, pior para leitor de tela do que role
          nenhum (anuncia "item de menu" sem contexto de menu ao redor). O
          ScrollView vira o ancestral com role "menu". */}
      <ScrollView
        style={styles.nav}
        contentContainerStyle={styles.navContent}
        accessibilityRole="menu"
      >
        {NAV_ITEMS.map((item) => {
          // Realce do item ativo compara contra o nome REGISTRADO no
          // navigator (`routeName`, quando presente), não contra `item.name`
          // puro — ver comentário de `NavItem.routeName` acima (fix wave
          // pós-G2, CQ-05 item 1).
          const isActive = activeRouteName === (item.routeName ?? item.name);
          return (
            <NavDrawerItem
              key={item.name}
              item={item}
              isActive={isActive}
              styles={styles}
              colors={colors}
            />
          );
        })}
      </ScrollView>

      {usuario && (
        <SafeAreaView style={styles.footer} edges={['bottom']}>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {usuario.nmVeterinario}
            </Text>
            <Text style={styles.userCrmv}>{usuario.nrCRMV}</Text>
          </View>
          <TouchableOpacity
            onPress={clearSession}
            onMouseEnter={logoutInteraction.onMouseEnter}
            onMouseLeave={logoutInteraction.onMouseLeave}
            onFocus={logoutInteraction.onFocus}
            onBlur={logoutInteraction.onBlur}
            style={getWebInteractionStyle(logoutInteraction, colors.textOnPrimary)}
            testID="nav-drawer-logout"
            accessibilityRole="button"
            accessibilityLabel={STRINGS.configuracoes.sair}
          >
            <KCIcon name="close" size={20} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </View>
  );
}
