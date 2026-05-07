import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { KCButton } from '../src/components/primitives/KCButton';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('KCButton', () => {
  describe('variants', () => {
    it('renders primary variant', () => {
      const { toJSON } = wrap(<KCButton variant="primary">Login</KCButton>);
      expect(toJSON()).toMatchSnapshot();
    });

    it('renders secondary variant', () => {
      const { toJSON } = wrap(<KCButton variant="secondary">Cancel</KCButton>);
      expect(toJSON()).toMatchSnapshot();
    });

    it('renders ghost variant', () => {
      const { toJSON } = wrap(<KCButton variant="ghost">Skip</KCButton>);
      expect(toJSON()).toMatchSnapshot();
    });

    it('renders danger variant', () => {
      const { toJSON } = wrap(<KCButton variant="danger">Delete</KCButton>);
      expect(toJSON()).toMatchSnapshot();
    });
  });

  describe('sizes', () => {
    it('renders sm size', () => {
      const { toJSON } = wrap(<KCButton size="sm">Small</KCButton>);
      expect(toJSON()).toMatchSnapshot();
    });

    it('renders md size', () => {
      const { toJSON } = wrap(<KCButton size="md">Medium</KCButton>);
      expect(toJSON()).toMatchSnapshot();
    });

    it('renders lg size', () => {
      const { toJSON } = wrap(<KCButton size="lg">Large</KCButton>);
      expect(toJSON()).toMatchSnapshot();
    });
  });

  describe('onPress behavior', () => {
    it('calls onPress when tapped', () => {
      const onPress = jest.fn();
      const { getByText } = wrap(<KCButton onPress={onPress}>Tap Me</KCButton>);
      fireEvent.press(getByText('Tap Me'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onPress when disabled', () => {
      const onPress = jest.fn();
      const { getByText } = wrap(
        <KCButton disabled onPress={onPress}>Disabled</KCButton>,
      );
      fireEvent.press(getByText('Disabled'));
      expect(onPress).not.toHaveBeenCalled();
    });

    it('does NOT call onPress when loading', () => {
      const onPress = jest.fn();
      const { UNSAFE_getByType } = wrap(
        <KCButton loading onPress={onPress}>Loading</KCButton>,
      );
      const indicator = UNSAFE_getByType(ActivityIndicator);
      fireEvent.press(indicator);
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('renders ActivityIndicator when loading=true', () => {
      const { UNSAFE_getByType, queryByText } = wrap(
        <KCButton loading>Submit</KCButton>,
      );
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
      expect(queryByText('Submit')).toBeNull();
    });

    it('does NOT render ActivityIndicator when loading=false', () => {
      const { UNSAFE_queryByType, getByText } = wrap(
        <KCButton loading={false}>Submit</KCButton>,
      );
      expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull();
      expect(getByText('Submit')).toBeTruthy();
    });
  });

  describe('icons', () => {
    it('renders iconLeft alongside children', () => {
      const { getByTestId, getByText } = wrap(
        <KCButton iconLeft={<Text testID="icon-left">★</Text>}>With Icon</KCButton>,
      );
      expect(getByTestId('icon-left')).toBeTruthy();
      expect(getByText('With Icon')).toBeTruthy();
    });

    it('renders iconRight alongside children', () => {
      const { getByTestId } = wrap(
        <KCButton iconRight={<Text testID="icon-right">→</Text>}>Right</KCButton>,
      );
      expect(getByTestId('icon-right')).toBeTruthy();
    });

    it('hides icons when loading', () => {
      const { queryByTestId } = wrap(
        <KCButton loading iconLeft={<Text testID="icon-l">★</Text>}>Loading</KCButton>,
      );
      expect(queryByTestId('icon-l')).toBeNull();
    });
  });

  describe('md size WCAG touch target', () => {
    it('md height is at least 48px', () => {
      const { UNSAFE_getByType } = wrap(<KCButton size="md">Touch</KCButton>);
      const touchable = UNSAFE_getByType(require('react-native').TouchableOpacity);
      const flatStyle = Array.isArray(touchable.props.style)
        ? Object.assign({}, ...touchable.props.style.filter(Boolean))
        : touchable.props.style;
      expect(flatStyle.height).toBeGreaterThanOrEqual(48);
    });
  });
});
