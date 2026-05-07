import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCIcon } from '@components/primitives/KCIcon';
import type { KCIconName } from '@components/primitives/KCIcon';
import { useAuthStore } from '@store/authStore';
import { STRINGS } from '@constants/strings';

interface NavItem {
  name: string;
  icon: KCIconName;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
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

export function NavDrawer({ state, navigation }: DrawerContentComponentProps) {
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
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => navigation.navigate(item.name)}
              accessibilityRole="menuitem"
              testID={`nav-item-${item.name}`}
            >
              <KCIcon name={item.icon} size={20} color={colors.textOnPrimary} />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
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
