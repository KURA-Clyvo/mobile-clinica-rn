import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '@services/queryClient';
import { VeterinarioResponse } from '../types/api';
import type { TipoPerfilUsuario } from '../utils/perfilUsuario';

// store/authStore.ts
//
// FM-01 — desenho revisado. O backend (TokenResponseDto, backend-clinica-dotnet
// de96c70) separa DOIS conceitos que este store, até a FM-01, misturava num
// só campo (`usuario: VeterinarioResponse`):
//
//   1. QUEM SOU — sempre existe pós-login: `email` (o que a pessoa digitou no
//      formulário — ver nota abaixo) e `tpPerfil` ('GESTOR' | 'VETERINARIO',
//      vem sempre no corpo da resposta, nunca nulo).
//   2. MINHA FICHA DE VETERINÁRIO — só existe se a pessoa tiver vínculo em
//      VETERINARIO. Um GESTOR sem vínculo loga normalmente e `usuario` vem
//      `null` (o próprio DTO documenta isso — não é bug, é o contrato novo).
//
// Sem essa separação, cada tela que precisasse mostrar "quem está logado"
// teria que reconstruir identidade a partir de uma ficha que pode não
// existir — exatamente o defeito que a tabela de 7 sítios do backlog
// descreve (NavDrawer sem nome, saudação vazia, telas que travam em
// silêncio). Com os dois campos sempre presentes, "quem sou" nunca depende
// de "tenho ficha".
//
// De onde vem `email`: o corpo de LoginResponse NÃO traz o e-mail do usuário
// quando `usuario` é nulo — o `.NET` só o põe dentro do JWT, que este app
// deliberadamente não decodifica (zero biblioteca de decode em src/). A
// saída adotada é guardar o e-mail que a PESSOA DIGITOU no formulário de
// login (ou o `dsEmailAcesso` do registro de clínica) — sempre disponível
// no cliente, sem depender de decodificar nada. Ver
// useAuth.ts::useLoginMutation/useRegisterMutation.
interface SetSessionParams {
  token: string;
  expiresAt: string;
  email: string;
  tpPerfil: TipoPerfilUsuario;
  usuario: VeterinarioResponse | null;
}

interface AuthState {
  token: string | null;
  expiresAt: string | null;
  email: string | null;
  tpPerfil: TipoPerfilUsuario | null;
  usuario: VeterinarioResponse | null;
  _hasHydrated: boolean; // ← adiciona isso
  setHasHydrated: (state: boolean) => void; // ← e isso
  setSession: (params: SetSessionParams) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      expiresAt: null,
      email: null,
      tpPerfil: null,
      usuario: null,
      _hasHydrated: false, // ← começa false

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setSession: ({ token, expiresAt, email, tpPerfil, usuario }) => {
        set({ token, expiresAt, email, tpPerfil, usuario });
      },

      clearSession: () => {
        set({ token: null, expiresAt: null, email: null, tpPerfil: null, usuario: null });
        queryClient.clear();
      },

      isAuthenticated: () => {
        const { token, expiresAt } = get();
        if (!token || !expiresAt) return false;
        return new Date(expiresAt) > new Date();
      },
    }),
    {
      name: 'kura-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        token: state.token,
        expiresAt: state.expiresAt,
        email: state.email,
        tpPerfil: state.tpPerfil,
        usuario: state.usuario,
      }),
      onRehydrateStorage: () => (state) => {
        // ← chamado quando o AsyncStorage termina de ser lido
        state?.setHasHydrated(true);
      },
    },
  ),
);
