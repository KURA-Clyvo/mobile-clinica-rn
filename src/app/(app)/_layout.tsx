import { Redirect } from 'expo-router';
import { Drawer } from 'expo-router/drawer';
import { useAuthStore } from '@store/authStore';
import { NavDrawer } from '@components/layout/NavDrawer';
import { AppHeader } from '@components/layout/AppHeader';
import { STRINGS } from '@constants/strings';

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated()) {
    return <Redirect href="/login" />;
  }

  return (
    <Drawer
      drawerContent={(props) => <NavDrawer {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Drawer.Screen
        name="dashboard"
        options={{
          headerShown: true,
          header: ({ navigation }) => (
            <AppHeader
              title={STRINGS.dashboard.titulo}
              onMenuPress={() => (navigation as any).toggleDrawer?.()}
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
              onMenuPress={() => (navigation as any).toggleDrawer?.()}
            />
          ),
        }}
      />
      <Drawer.Screen
        name="pacientes"
        options={{
          headerShown: true,
          header: ({ navigation }) => (
            <AppHeader
              title={STRINGS.pacientes.titulo}
              onMenuPress={() => (navigation as any).toggleDrawer?.()}
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
              onMenuPress={() => (navigation as any).toggleDrawer?.()}
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
              onMenuPress={() => (navigation as any).toggleDrawer?.()}
            />
          ),
        }}
      />
    </Drawer>
  );
}
