import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — item 3: persistência do
// checklist de ativação. Mesmo padrão de `src/store/authStore.ts`, incluindo
// `_hasHydrated`/`setHasHydrated` — sem isso o card pisca visível e some na
// hidratação (defeito visível na demonstração, citado explicitamente no
// brief da task).
//
// Os 4 passos são fixos (rotas estáticas de `ROUTES.app`, ver
// `OnboardingChecklist.tsx`) — o id do passo é a chave usada tanto para
// marcar conclusão quanto para casar com o pathname visitado em `_layout.tsx`.
export const ONBOARDING_STEPS = ['agenda', 'pacientes', 'luna', 'settings'] as const;
export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number];

interface OnboardingState {
  completedSteps: OnboardingStepId[];
  dismissed: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  /** Marca um passo como concluído — idempotente (chamar de novo para um
   *  passo já concluído não duplica nem reordena a lista). */
  markStepCompleted: (step: OnboardingStepId) => void;
  /** Esconde o card. Não mexe em `completedSteps` — dispensar não é o mesmo
   *  que "esquecer o progresso". */
  dismiss: () => void;
  /** Item 4 do escopo (re-acesso em Configurações): volta a MOSTRAR o card,
   *  preservando os passos já concluídos — "quem já sabe, pula; quem quer
   *  rever, acha em Configurações", nunca reseta o que o usuário já fez. */
  reopen: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      completedSteps: [],
      dismissed: false,
      _hasHydrated: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      markStepCompleted: (step) => {
        const { completedSteps } = get();
        if (completedSteps.includes(step)) return;
        set({ completedSteps: [...completedSteps, step] });
      },

      dismiss: () => set({ dismissed: true }),

      reopen: () => set({ dismissed: false }),
    }),
    {
      name: 'kura-onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        completedSteps: state.completedSteps,
        dismissed: state.dismissed,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
