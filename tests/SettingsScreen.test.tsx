import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockClearSession = jest.fn();
const mockToggleTheme = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children, style }: { children: unknown; style: unknown }) => {
    const { View } = require('react-native');
    const R = require('react');
    return R.createElement(View, { style }, children);
  },
}));

jest.mock('@store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@services/queryClient', () => ({
  queryClient: { clear: jest.fn() },
}));

jest.mock('@theme/index', () => ({
  ...jest.requireActual('@theme/index'),
  useTheme: jest.fn(),
}));

import { useAuthStore } from '../src/store/authStore';
import { useTheme } from '../src/theme';
import { queryClient } from '../src/services/queryClient';
import SettingsScreen from '../src/app/(app)/settings';

const mockUseAuthStore = useAuthStore as jest.Mock;
const mockUseTheme = useTheme as jest.Mock;
const mockQueryClientClear = queryClient.clear as jest.Mock;

const MOCK_VET = {
  id: 1,
  nmVeterinario: 'Dr. Felipe Souza',
  nrCRMV: 'SP-12345',
  dsEmail: 'felipe@kura.vet',
  dsTelefone: '11999990001',
};

function wrap(ui: React.ReactElement) {
  return render(ui);
}

beforeEach(() => {
  jest.clearAllMocks();
  const { lightColors, spacing, radius, fontSize, fonts } = jest.requireActual(
    '../src/theme/tokens',
  );
  mockUseTheme.mockReturnValue({
    colors: lightColors,
    isDark: false,
    toggleTheme: mockToggleTheme,
    spacing,
    radius,
    fontSize,
    fonts,
  });
  mockUseAuthStore.mockImplementation((selector: (s: unknown) => unknown) =>
    selector({
      usuario: MOCK_VET,
      clearSession: mockClearSession,
    }),
  );
  mockClearSession.mockResolvedValue(undefined);
  mockQueryClientClear.mockClear();
});

describe('SettingsScreen', () => {
  it('displays vet name and CRMV from authStore', () => {
    const { getByTestId } = wrap(<SettingsScreen />);
    expect(getByTestId('vet-name').props.children).toBe('Dr. Felipe Souza');
    expect(getByTestId('vet-crmv').props.children).toBe('SP-12345');
  });

  it('calls toggleTheme when pressing dark mode switch', () => {
    const { getByTestId } = wrap(<SettingsScreen />);
    fireEvent(getByTestId('switch-dark-mode'), 'valueChange', true);
    expect(mockToggleTheme).toHaveBeenCalledWith(true);
  });

  it('dark mode switch has value matching isDark', () => {
    const { getByTestId } = wrap(<SettingsScreen />);
    expect(getByTestId('switch-dark-mode').props.value).toBe(false);
  });

  it('pressing "Sair da conta" shows confirmation Alert', () => {
    const spyAlert = jest.spyOn(require('react-native'), 'Alert', 'get').mockReturnValue({
      alert: jest.fn(),
    });
    const { getByTestId } = wrap(<SettingsScreen />);
    fireEvent.press(getByTestId('btn-sair'));
    expect(spyAlert.mock.results[0].value.alert).toHaveBeenCalledWith(
      'Sair?',
      'Sua sessão será encerrada.',
      expect.any(Array),
    );
    spyAlert.mockRestore();
  });

  it('confirms logout: calls clearSession, queryClient.clear() and navigates to /login', async () => {
    let logoutCallback: (() => void) | undefined;
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(
      (_title: unknown, _msg: unknown, buttons: Array<{ text: string; onPress?: () => void }>) => {
        const sairBtn = buttons.find((b) => b.text === 'Sair');
        logoutCallback = sairBtn?.onPress;
      },
    );
    const { getByTestId } = wrap(<SettingsScreen />);
    fireEvent.press(getByTestId('btn-sair'));
    await waitFor(() => expect(logoutCallback).toBeDefined());
    await logoutCallback!();
    expect(mockClearSession).toHaveBeenCalled();
    expect(mockQueryClientClear).toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('cancels logout: does not navigate', () => {
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = wrap(<SettingsScreen />);
    fireEvent.press(getByTestId('btn-sair'));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
