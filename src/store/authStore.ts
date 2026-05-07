import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient } from '@services/queryClient';
import { VeterinarioResponse } from '../types/api';

interface AuthState {
  token: string | null;
  expiresAt: string | null;
  usuario: VeterinarioResponse | null;
  setSession: (token: string, expiresAt: string, usuario: VeterinarioResponse) => void;
  clearSession: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      expiresAt: null,
      usuario: null,

      setSession: (token, expiresAt, usuario) => {
        set({ token, expiresAt, usuario });
      },

      clearSession: () => {
        set({ token: null, expiresAt: null, usuario: null });
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
        usuario: state.usuario,
      }),
    },
  ),
);
