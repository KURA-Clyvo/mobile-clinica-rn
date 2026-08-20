import React from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { Link } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCIcon } from '@components/primitives/KCIcon';
import type { KCIconName } from '@components/primitives/KCIcon';
import { useAuthStore } from '@store/authStore';
import { STRINGS } from '@constants/strings';
import { ROUTES } from '@constants/routes';

// Nomes de tela do navigator do drawer (não são rotas/URL): chaves de
// `ROUTES.app` cujo valor é uma string estática (exclui os helpers de rota
// dinâmica, como `pacienteDetalhe`, que são funções). Cada item do drawer
// precisa de DOIS papéis distintos — ver task CQ-03 (dev VsClaude,
// KURA_BACKLOG_CLINICA_1, M2): `name` compara com `state.routes[].name` do
// react-navigation para o realce do item ativo; `href` (derivado de `name`
// via indexação em `ROUTES.app`, nunca duplicado à mão) alimenta o `<Link>`.
// Renomear uma tela em `ROUTES.app` quebra este arquivo em `tsc`, porque o
// tipo de `name` deixa de aceitar o valor antigo.
type ScreenRouteName = {
  [K in keyof typeof ROUTES.app]: (typeof ROUTES.app)[K] extends string ? K : never;
}[keyof typeof ROUTES.app];

interface NavItem {
  name: ScreenRouteName;
  icon: KCIconName;
  label: string;
}

// Exportado para o teste de sincronia com `_layout.tsx` (fix wave pós-G2, item
// 2 da CQ-03 — ver `discoverDrawerScreenNames.ts` e
// `tests/NavDrawer.drawerScreenSync.test.ts`): é o lado "o que o drawer
// oferece" do acoplamento com "o que `_layout.tsx` registra como tela".
export const NAV_ITEMS: NavItem[] = [
  { name: 'dashboard', icon: 'dashboard', label: STRINGS.dashboard.titulo },
  { name: 'agenda', icon: 'agenda', label: 'Agenda' },
  { name: 'pacientes', icon: 'patients', label: STRINGS.pacientes.titulo },
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

export function NavDrawer({ state }: DrawerContentComponentProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { usuario, clearSession } = useAuthStore();
  const activeRouteName = state.routes[state.index]?.name;

  return (
    <View style={styles.container} testID="nav-drawer">
      <SafeAreaView style={styles.header} edges={['top']}>
        <KCIcon name="paw" size={32} color={colors.textOnPrimary} />
        <Text style={styles.brandName}>{STRINGS.app.name}</Text>
      </SafeAreaView>

      <ScrollView style={styles.nav} contentContainerStyle={styles.navContent}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeRouteName === item.name;
          // `href` deriva de `item.name` por indexação em ROUTES.app — nunca
          // escrito à mão em paralelo, para não poder divergir do nome de
          // tela sem quebrar em tsc (ver comentário de ScreenRouteName acima).
          const href = ROUTES.app[item.name];
          return (
            <Link key={item.name} href={href} asChild>
              <Pressable
                style={({ pressed }) => [
                  styles.navItem,
                  isActive && styles.navItemActive,
                  pressed && styles.navItemPressed,
                ]}
                accessibilityRole="menuitem"
                testID={`nav-item-${item.name}`}
              >
                <KCIcon name={item.icon} size={20} color={colors.textOnPrimary} />
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            </Link>
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
            testID="nav-drawer-logout"
            accessibilityLabel={STRINGS.configuracoes.sair}
          >
            <KCIcon name="close" size={20} color={colors.textOnPrimary} />
          </TouchableOpacity>
        </SafeAreaView>
      )}
    </View>
  );
}
