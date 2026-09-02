import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { login, registerClinica } from '@services/auth.service';
import { useAuthStore } from '@store/authStore';
import { ROUTES } from '@constants/routes';
import type {
  LoginRequest,
  LoginResponse,
  RegisterClinicaRequest,
  RegisterClinicaResponse,
} from '../types/api';

export function useLoginMutation() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation<LoginResponse, unknown, LoginRequest>({
    mutationFn: (data) => login(data),
    // FM-01: `variables` é o segundo argumento de onSuccess do react-query —
    // o corpo que ESTA mutação enviou, não a resposta do servidor. O e-mail
    // que a pessoa digitou (`variables.dsEmail`) é a fonte de "quem sou"
    // quando `response.usuario` vem nulo (GESTOR sem ficha) — ver desenho
    // do store em authStore.ts.
    onSuccess: (response, variables) => {
      setSession({
        token: response.accessToken,
        expiresAt: response.expiresAt,
        email: variables.dsEmail,
        tpPerfil: response.tpPerfil,
        usuario: response.usuario,
      });
      router.replace(ROUTES.app.dashboard);
    },
  });
}

export function useRegisterMutation() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation<RegisterClinicaResponse, unknown, RegisterClinicaRequest>({
    mutationFn: (data) => registerClinica(data),
    // Registro de clínica sempre devolve `usuario` não-nulo (o gestor admin
    // criado na mesma transação) — mas o e-mail segue vindo do formulário,
    // pelo mesmo motivo do login: consistência de fonte, não necessidade
    // (poderia vir de `response.usuario.dsEmail`, sempre idêntico aqui).
    onSuccess: (response, variables) => {
      setSession({
        token: response.accessToken,
        expiresAt: response.expiresAt,
        email: variables.dsEmailAcesso,
        tpPerfil: response.tpPerfil,
        usuario: response.usuario,
      });
      router.replace(ROUTES.app.dashboard);
    },
  });
}