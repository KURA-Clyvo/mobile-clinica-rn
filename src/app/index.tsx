// app/index.tsx
import { Redirect } from 'expo-router';
import { Abertura } from '@components/brand/Abertura';
import { useAuthStore } from '@store/authStore';
import { ROUTES } from '@constants/routes';

export default function Index() {
  const { isAuthenticated, _hasHydrated } = useAuthStore();

  // Aguarda o AsyncStorage terminar de hidratar
  // Abertura (BR-CLI-T04) no lugar do spinner cru. Ela não espera a própria animação:
  // assim que a sessão hidrata este componente devolve o Redirect e ela é desmontada.
  if (!_hasHydrated) return <Abertura />;

  return <Redirect href={isAuthenticated() ? ROUTES.app.dashboard : ROUTES.login} />;
}