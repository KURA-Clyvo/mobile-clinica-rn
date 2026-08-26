// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — testes do componente
// (item 2 do escopo). "Visita marca o passo" é testado à parte, em
// AppLayoutSidebar.test.tsx (o rastreio mora em `_layout.tsx`, ponto único,
// não neste componente).
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from '../src/theme';
import { OnboardingChecklist } from '../src/components/domain/OnboardingChecklist';
import { useOnboardingStore } from '../src/store/onboardingStore';

// Mesmo padrão de mock de `Link asChild` usado em
// tests/touchTargetRegistry.tsx: clona o filho único acrescentando
// `accessibilityHint: 'href:<href>'`, o suficiente pra provar QUAL rota cada
// passo aponta sem precisar de um `NavigationContainer` real.
jest.mock('expo-router', () => {
  const ReactForMock = require('react');
  return {
    Link: ({
      href,
      asChild,
      children,
    }: {
      href: string;
      asChild?: boolean;
      children: React.ReactNode;
    }) => {
      if (asChild && ReactForMock.isValidElement(children)) {
        return ReactForMock.cloneElement(children, { accessibilityHint: `href:${href}` });
      }
      return ReactForMock.createElement(ReactForMock.Fragment, null, children);
    },
  };
});

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.setState({ completedSteps: [], dismissed: false, _hasHydrated: true });
});

describe('OnboardingChecklist — hidratação e visibilidade', () => {
  it('não renderiza antes da hidratação (_hasHydrated:false) — evita o card piscar e sumir', () => {
    useOnboardingStore.setState({ _hasHydrated: false });
    const { queryByTestId } = wrap(<OnboardingChecklist />);
    expect(queryByTestId('onboarding-checklist')).toBeNull();
  });

  it('renderiza depois de hidratado, quando não dispensado', () => {
    const { getByTestId } = wrap(<OnboardingChecklist />);
    expect(getByTestId('onboarding-checklist')).toBeTruthy();
  });

  it('não renderiza quando dismissed:true', () => {
    useOnboardingStore.setState({ dismissed: true });
    const { queryByTestId } = wrap(<OnboardingChecklist />);
    expect(queryByTestId('onboarding-checklist')).toBeNull();
  });
});

describe('OnboardingChecklist — progresso ("N de 4 restantes")', () => {
  it('mostra "4 de 4 restantes" com nenhum passo concluído', () => {
    const { getByText } = wrap(<OnboardingChecklist />);
    expect(getByText('4 de 4 restantes')).toBeTruthy();
  });

  it('mostra "3 de 4 restantes" com 1 passo concluído', () => {
    useOnboardingStore.setState({ completedSteps: ['agenda'] });
    const { getByText } = wrap(<OnboardingChecklist />);
    expect(getByText('3 de 4 restantes')).toBeTruthy();
  });

  it('mostra a mensagem de conclusão quando os 4 passos estão feitos', () => {
    useOnboardingStore.setState({ completedSteps: ['agenda', 'pacientes', 'luna', 'settings'] });
    const { getByText } = wrap(<OnboardingChecklist />);
    expect(getByText('Você concluiu os primeiros passos.')).toBeTruthy();
  });
});

describe('OnboardingChecklist — os 4 passos apontam para rota real', () => {
  it.each([
    ['onboarding-step-agenda', '/agenda'],
    ['onboarding-step-pacientes', '/pacientes'],
    ['onboarding-step-luna', '/luna'],
    ['onboarding-step-settings', '/settings'],
  ])('%s navega para %s', (testId, expectedHref) => {
    const { getByTestId } = wrap(<OnboardingChecklist />);
    expect(getByTestId(testId).props.accessibilityHint).toBe(`href:${expectedHref}`);
  });
});

describe('OnboardingChecklist — dispensar (item 3: persistência real)', () => {
  it('some depois de dispensado, grava no AsyncStorage e NÃO volta numa remontagem', async () => {
    const { getByTestId, queryByTestId, unmount } = wrap(<OnboardingChecklist />);
    expect(getByTestId('onboarding-checklist')).toBeTruthy();

    fireEvent.press(getByTestId('onboarding-dismiss'));
    expect(queryByTestId('onboarding-checklist')).toBeNull();

    // Prova de mordida: o `zustand/persist` grava de forma assíncrona (após
    // o `set()`) — espera a escrita real no AsyncStorage, não confia só no
    // estado em memória (que sozinho não provaria persistência nenhuma).
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'kura-onboarding-storage',
        expect.stringContaining('"dismissed":true'),
      ),
    );

    unmount();
    // Remonta o MESMO componente — a store (singleton do módulo) continua
    // viva com `dismissed:true`, exatamente como aconteceria reabrindo a
    // tela sem fechar o app. Ver §5 do relatório da task para o limite desta
    // prova (não simula um restart completo do processo).
    const { queryByTestId: queryAfterRemount } = wrap(<OnboardingChecklist />);
    expect(queryAfterRemount('onboarding-checklist')).toBeNull();
  });
});
