import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { login } from '@services/auth.service';
import { useAuthStore } from '@store/authStore';
import { ROUTES } from '@constants/routes';
import type { LoginRequest, LoginResponse } from '../types/api';

export function useLoginMutation() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation<LoginResponse, unknown, LoginRequest>({
    mutationFn: (data) => login(data),
    onSuccess: (response) => {
      setSession(response.accessToken, response.expiresAt, response.usuario);
      router.replace(ROUTES.app.dashboard as never);
    },
  });
}
