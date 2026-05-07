import React from 'react';
import { Text, ScrollView } from 'react-native';
import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { ScreenContainer } from '../src/components/primitives/ScreenContainer';

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children, style }: { children: React.ReactNode; style?: unknown }) =>
      React.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('ScreenContainer', () => {
  it('renders children', () => {
    const { getByText } = wrap(
      <ScreenContainer><Text>Hello World</Text></ScreenContainer>,
    );
    expect(getByText('Hello World')).toBeTruthy();
  });

  it('renders ScrollView when scroll=true (default)', () => {
    const { UNSAFE_getByType } = wrap(
      <ScreenContainer><Text>Scrollable</Text></ScreenContainer>,
    );
    expect(UNSAFE_getByType(ScrollView)).toBeTruthy();
  });

  it('does NOT render ScrollView when scroll=false', () => {
    const { UNSAFE_queryByType } = wrap(
      <ScreenContainer scroll={false}><Text>Flat</Text></ScreenContainer>,
    );
    expect(UNSAFE_queryByType(ScrollView)).toBeNull();
  });

  it('passes refreshControl to ScrollView', () => {
    const mockRefreshControl = <Text testID="refresh-control">Refresh</Text>;
    const { getByTestId } = wrap(
      <ScreenContainer refreshControl={mockRefreshControl}>
        <Text>Content</Text>
      </ScreenContainer>,
    );
    expect(getByTestId('refresh-control')).toBeTruthy();
  });

  it('refreshControl is ignored when scroll=false', () => {
    const mockRefreshControl = <Text testID="refresh-ignored">Refresh</Text>;
    const { queryByTestId } = wrap(
      <ScreenContainer scroll={false} refreshControl={mockRefreshControl}>
        <Text>Content</Text>
      </ScreenContainer>,
    );
    expect(queryByTestId('refresh-ignored')).toBeNull();
  });

  it('accepts custom paddingHorizontal', () => {
    expect(() =>
      wrap(
        <ScreenContainer paddingHorizontal={24}><Text>Padded</Text></ScreenContainer>,
      ),
    ).not.toThrow();
  });
});
