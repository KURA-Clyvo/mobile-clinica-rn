import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { KCCard } from '../src/components/primitives/KCCard';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('KCCard', () => {
  it('renders children', () => {
    const { getByText } = wrap(
      <KCCard><Text>Card Content</Text></KCCard>,
    );
    expect(getByText('Card Content')).toBeTruthy();
  });

  it('uses View when no onPress given', () => {
    const { UNSAFE_queryByType } = wrap(
      <KCCard><Text>Static</Text></KCCard>,
    );
    expect(UNSAFE_queryByType(TouchableOpacity)).toBeNull();
  });

  it('uses TouchableOpacity when onPress given', () => {
    const { UNSAFE_getByType } = wrap(
      <KCCard onPress={jest.fn()}><Text>Pressable</Text></KCCard>,
    );
    expect(UNSAFE_getByType(TouchableOpacity)).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = wrap(
      <KCCard onPress={onPress}><Text>Press me</Text></KCCard>,
    );
    fireEvent.press(getByText('Press me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders elevated variant without crash', () => {
    expect(() =>
      wrap(<KCCard elevated><Text>Elevated</Text></KCCard>),
    ).not.toThrow();
  });

  it('snapshot — static card', () => {
    const { toJSON } = wrap(
      <KCCard><Text>Static Card</Text></KCCard>,
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it('snapshot — pressable card', () => {
    const { toJSON } = wrap(
      <KCCard onPress={jest.fn()}><Text>Pressable Card</Text></KCCard>,
    );
    expect(toJSON()).toMatchSnapshot();
  });
});
