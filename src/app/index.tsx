// app/index.tsx
import { Redirect } from 'expo-router';
import { Abertura } from '@components/brand/Abertura';
import { useFontesProntas } from '@components/brand/FontesProntas';
import { useAuthStore } from '@store/authStore';
import { ROUTES } from '@constants/routes';

export default function Index() {
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const fontesProntas = useFontesProntas();

  // Abertura (BR-CLI-T04) no lugar do spinner cru. Ela cobre "fontes e sessão" (PLANO_BRANDING
  // §2b): fica enquanto o AsyncStorage não hidratou OU as fontes não carregaram — a primeira
  // tela não pode aparecer em fonte de sistema. Ela não espera a própria animação: assim que
  // as duas coisas ficam prontas este componente devolve o Redirect e ela é desmontada.
  if (!_hasHydrated || !fontesProntas) return <Abertura />;

  return <Redirect href={isAuthenticated() ? ROUTES.app.dashboard : ROUTES.login} />;
}
