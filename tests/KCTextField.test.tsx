import React from 'react';
import { TextInput } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { KCTextField } from '../src/components/primitives/KCTextField';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('KCTextField', () => {
  it('renders the label', () => {
    const { getByText } = wrap(
      <KCTextField label="Email" value="" onChangeText={jest.fn()} />,
    );
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders error message when error prop is provided', () => {
    const { getByText } = wrap(
      <KCTextField label="Email" value="" onChangeText={jest.fn()} error="Campo obrigatório" />,
    );
    expect(getByText('Campo obrigatório')).toBeTruthy();
  });

  it('does NOT render error when error is absent', () => {
    const { queryByText } = wrap(
      <KCTextField label="Email" value="" onChangeText={jest.fn()} />,
    );
    expect(queryByText('Campo obrigatório')).toBeNull();
  });

  it('renders helperText when error is absent', () => {
    const { getByText } = wrap(
      <KCTextField
        label="Email"
        value=""
        onChangeText={jest.fn()}
        helperText="Use seu email corporativo"
      />,
    );
    expect(getByText('Use seu email corporativo')).toBeTruthy();
  });

  it('does NOT render helperText when error is present', () => {
    const { queryByText } = wrap(
      <KCTextField
        label="Email"
        value=""
        onChangeText={jest.fn()}
        error="Inválido"
        helperText="Use seu email corporativo"
      />,
    );
    expect(queryByText('Use seu email corporativo')).toBeNull();
  });

  it('handles focus event without crashing', () => {
    const { getByTestId } = wrap(
      <KCTextField label="Email" value="" onChangeText={jest.fn()} />,
    );
    expect(() => fireEvent(getByTestId('kc-text-input'), 'focus')).not.toThrow();
  });

  it('handles blur event and calls onBlur prop', () => {
    const onBlur = jest.fn();
    const { getByTestId } = wrap(
      <KCTextField label="Email" value="" onChangeText={jest.fn()} onBlur={onBlur} />,
    );
    fireEvent(getByTestId('kc-text-input'), 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('calls onChangeText when text changes', () => {
    const onChangeText = jest.fn();
    const { getByTestId } = wrap(
      <KCTextField label="Email" value="" onChangeText={onChangeText} />,
    );
    fireEvent.changeText(getByTestId('kc-text-input'), 'test@email.com');
    expect(onChangeText).toHaveBeenCalledWith('test@email.com');
  });

  describe('password toggle', () => {
    it('shows toggle button when secureTextEntry=true', () => {
      const { getByTestId } = wrap(
        <KCTextField
          label="Senha"
          value=""
          onChangeText={jest.fn()}
          secureTextEntry
        />,
      );
      expect(getByTestId('password-toggle')).toBeTruthy();
    });

    it('does NOT show toggle button when secureTextEntry=false', () => {
      const { queryByTestId } = wrap(
        <KCTextField
          label="Email"
          value=""
          onChangeText={jest.fn()}
          secureTextEntry={false}
        />,
      );
      expect(queryByTestId('password-toggle')).toBeNull();
    });

    it('toggles secureTextEntry when toggle is pressed', () => {
      const { getByTestId, UNSAFE_getByType } = wrap(
        <KCTextField
          label="Senha"
          value=""
          onChangeText={jest.fn()}
          secureTextEntry
        />,
      );
      const input = UNSAFE_getByType(TextInput);
      expect(input.props.secureTextEntry).toBe(true);
      fireEvent.press(getByTestId('password-toggle'));
      expect(input.props.secureTextEntry).toBe(false);
    });
  });
});
