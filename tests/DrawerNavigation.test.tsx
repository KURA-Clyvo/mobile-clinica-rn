import React from 'react';
import { DeviceEventEmitter } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { AppHeader } from '../src/components/layout/AppHeader';
import { useAuthStore } from '../src/store/authStore';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

const MOCK_VET = {
  id: 1,
  nmVeterinario: 'Dr. Felipe Ferrete',
  nrCRMV: 'SP-12345',
  dsEmail: 'felipe@kuraclinica.com.br',
};

beforeEach(() => {
  useAuthStore.setState({ token: null, expiresAt: null, usuario: null });
  jest.clearAllMocks();
});

describe('AppHeader', () => {
  it('renders the provided title', () => {
    const { getByText } = wrap(<AppHeader title="Dashboard" onMenuPress={() => {}} />);
    expect(getByText('Dashboard')).toBeTruthy();
  });

  it('renders search and bell action buttons', () => {
    const { getByTestId } = wrap(<AppHeader title="Test" onMenuPress={() => {}} />);
    expect(getByTestId('app-header-search')).toBeTruthy();
    expect(getByTestId('app-header-bell')).toBeTruthy();
  });

  it('calls onMenuPress when menu button is pressed', () => {
    const onMenuPress = jest.fn();
    const { getByTestId } = wrap(<AppHeader title="Test" onMenuPress={onMenuPress} />);
    fireEvent.press(getByTestId('app-header-menu'));
    expect(onMenuPress).toHaveBeenCalledTimes(1);
  });

  it('renders different titles without crash', () => {
    const titles = ['Dashboard', 'Agenda', 'Pacientes', 'Luna AI', 'Configurações'];
    titles.forEach((title) => {
      const { getByText, unmount } = wrap(<AppHeader title={title} onMenuPress={() => {}} />);
      expect(getByText(title)).toBeTruthy();
      unmount();
    });
  });
});

describe('auth:logout event integration', () => {
  it('clearSession empties token when called directly', () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    useAuthStore.getState().setSession('tok', futureDate, MOCK_VET);

    useAuthStore.getState().clearSession();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().expiresAt).toBeNull();
    expect(useAuthStore.getState().usuario).toBeNull();
  });

  it('auth:logout DeviceEventEmitter event clears session when listener is active', () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    useAuthStore.setState({ token: 'active-tok', expiresAt: futureDate, usuario: MOCK_VET });

    const sub = DeviceEventEmitter.addListener('auth:logout', () => {
      useAuthStore.getState().clearSession();
    });

    DeviceEventEmitter.emit('auth:logout');

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);

    sub.remove();
  });

  it('isAuthenticated returns false immediately after logout event', () => {
    const futureDate = new Date(Date.now() + 3_600_000).toISOString();
    useAuthStore.getState().setSession('tok', futureDate, MOCK_VET);
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);

    const sub = DeviceEventEmitter.addListener('auth:logout', () => {
      useAuthStore.getState().clearSession();
    });

    DeviceEventEmitter.emit('auth:logout');
    expect(useAuthStore.getState().isAuthenticated()).toBe(false);

    sub.remove();
  });
});
