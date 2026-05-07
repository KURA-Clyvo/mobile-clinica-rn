import { Redirect } from 'expo-router';
import { useAuthStore } from '@store/authStore';
import { ROUTES } from '@constants/routes';

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  const isAuth = isAuthenticated();
  return <Redirect href={(isAuth ? ROUTES.app.dashboard : ROUTES.login) as never} />;
}
