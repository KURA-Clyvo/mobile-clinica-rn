// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — testa a store isolada da UI,
// mesmo padrão de tests/authStore.test.ts (o par que `onboardingStore.ts`
// segue explicitamente: `_hasHydrated`/`setHasHydrated`). AsyncStorage real
// (mockado globalmente por `moduleNameMapper` em jest.config.js, não
// re-mockado aqui) — diferente de authStore.test.ts, que troca por um mock
// mais simples porque não precisa inspecionar o payload gravado.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { waitFor } from '@testing-library/react-native';
import { useOnboardingStore } from '../src/store/onboardingStore';

beforeEach(() => {
  useOnboardingStore.setState({ completedSteps: [], dismissed: false, _hasHydrated: false });
  jest.clearAllMocks();
});

describe('onboardingStore', () => {
  it('initial state: nenhum passo concluído, não dispensado, não hidratado', () => {
    const state = useOnboardingStore.getState();
    expect(state.completedSteps).toEqual([]);
    expect(state.dismissed).toBe(false);
  });

  it('markStepCompleted adiciona o passo', () => {
    useOnboardingStore.getState().markStepCompleted('agenda');
    expect(useOnboardingStore.getState().completedSteps).toEqual(['agenda']);
  });

  it('markStepCompleted é idempotente — chamar 2x para o mesmo passo não duplica', () => {
    useOnboardingStore.getState().markStepCompleted('agenda');
    useOnboardingStore.getState().markStepCompleted('agenda');
    expect(useOnboardingStore.getState().completedSteps).toEqual(['agenda']);
  });

  it('markStepCompleted preserva a ordem de chegada de passos diferentes', () => {
    useOnboardingStore.getState().markStepCompleted('luna');
    useOnboardingStore.getState().markStepCompleted('agenda');
    expect(useOnboardingStore.getState().completedSteps).toEqual(['luna', 'agenda']);
  });

  it('dismiss esconde o card sem mexer em completedSteps', () => {
    useOnboardingStore.getState().markStepCompleted('agenda');
    useOnboardingStore.getState().dismiss();
    const state = useOnboardingStore.getState();
    expect(state.dismissed).toBe(true);
    expect(state.completedSteps).toEqual(['agenda']);
  });

  it('reopen volta a mostrar o card SEM resetar completedSteps (critério literal do backlog)', () => {
    useOnboardingStore.getState().markStepCompleted('agenda');
    useOnboardingStore.getState().markStepCompleted('luna');
    useOnboardingStore.getState().dismiss();
    useOnboardingStore.getState().reopen();
    const state = useOnboardingStore.getState();
    expect(state.dismissed).toBe(false);
    expect(state.completedSteps).toEqual(['agenda', 'luna']);
  });

  // Prova de persistência REAL (não só estado em memória): o middleware
  // `persist` do zustand grava no AsyncStorage de forma assíncrona logo após
  // `set()` — espera a escrita de verdade acontecer e confere o payload
  // serializado, em vez de confiar só em `getState()`.
  it('dismiss() grava dismissed:true no AsyncStorage (persistência real, não só em memória)', async () => {
    useOnboardingStore.getState().dismiss();

    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'kura-onboarding-storage',
        expect.stringContaining('"dismissed":true'),
      ),
    );
  });

  it('markStepCompleted() grava a lista de passos concluídos no AsyncStorage', async () => {
    useOnboardingStore.getState().markStepCompleted('settings');

    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'kura-onboarding-storage',
        expect.stringContaining('"completedSteps":["settings"]'),
      ),
    );
  });
});
