// app/index.tsx
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuthStore } from '@store/authStore';
import { ROUTES } from '@constants/routes';

export default function Index() {
  const { isAuthenticated, _hasHydrated } = useAuthStore();

  // Aguarda o AsyncStorage terminar de hidratar
  if (!_hasHydrated) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={(isAuthenticated() ? ROUTES.app.dashboard : ROUTES.login) as never} />;
}