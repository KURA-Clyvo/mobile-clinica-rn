// BR-CLI-T02 — no web `Alert.alert` é no-op (react-native-web/dist/exports/Alert/index.js:
// `static alert() {}`), então "Sair da conta" nunca chegava a sair. Este teste monta
// Configurações com Platform.OS='web' e Alert.alert NO-OP (o comportamento real do RNW,
// não um mock que finge funcionar), toca no botão, confirma no modal e exige o token fora
// do storage.
import React from 'react';
import { Alert, Platform } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: { children: unknown; style: unknown }) => {
    const { View } = require('react-native');
    const R = require('react');
    return R.createElement(View, { style }, children);
  },
}));

import SettingsScreen from '../src/app/(app)/settings';
import { ConfirmHost } from '../src/components/feedback/ConfirmHost';
import { ToastProvider } from '../src/components/feedback/Toast';
import { ThemeProvider } from '../src/theme';
import { useAuthStore } from '../src/store/authStore';
import { AUTH_TOKEN_KEY } from '../src/services/api/client';

function montar() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <SettingsScreen />
        <ConfirmHost />
      </ToastProvider>
    </ThemeProvider>,
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'web');
  // Alert.alert do react-native-web: no-op.
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  useAuthStore.getState().setSession({
    token: 'tok-web',
    expiresAt: '2099-01-01T00:00:00Z',
    email: 'gestor@kura.local',
    tpPerfil: 'GESTOR',
    usuario: null,
  });
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, 'tok-web');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Configurações no web: Sair da conta', () => {
  it('abre o modal, confirma no botão "Sair" e remove o token do storage', async () => {
    const { getByText, findByTestId, getByTestId } = montar();
    fireEvent.press(getByText('Sair da conta'));
    // O modal é do app (não do Alert): aparece com o verbo da ação.
    await findByTestId('confirm-dialog');
    expect(getByText('Sair?')).toBeTruthy();
    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBe('tok-web'); // ainda logado
    await act(async () => {
      fireEvent.press(getByTestId('confirm-ok'));
    });
    await waitFor(async () => {
      expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    });
    expect(useAuthStore.getState().token).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('Cancelar mantém a sessão', async () => {
    const { getByText, findByTestId, getByTestId, queryByTestId } = montar();
    fireEvent.press(getByText('Sair da conta'));
    await findByTestId('confirm-dialog');
    await act(async () => {
      fireEvent.press(getByTestId('confirm-cancelar'));
    });
    await waitFor(() => expect(queryByTestId('confirm-dialog')).toBeNull());
    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBe('tok-web');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
