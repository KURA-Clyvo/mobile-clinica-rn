import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { KCChip, ChipTone } from '../src/components/primitives/KCChip';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

const TONES: ChipTone[] = ['sage', 'amber', 'clay', 'ocean', 'mute'];

describe('KCChip', () => {
  describe('tone snapshots', () => {
    TONES.forEach((tone) => {
      it(`renders ${tone} tone correctly`, () => {
        const { toJSON } = wrap(<KCChip tone={tone}>{tone}</KCChip>);
        expect(toJSON()).toMatchSnapshot();
      });
    });
  });

  it('renders children text', () => {
    const { getByText } = wrap(<KCChip>Consulta</KCChip>);
    expect(getByText('Consulta')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = wrap(<KCChip onPress={onPress}>Clicável</KCChip>);
    fireEvent.press(getByText('Clicável'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders without pressing when no onPress given', () => {
    const { getByText } = wrap(<KCChip>Só leitura</KCChip>);
    expect(() => fireEvent.press(getByText('Só leitura'))).not.toThrow();
  });

  it('renders dot indicator when dot=true', () => {
    const { getByTestId } = wrap(<KCChip dot>Com ponto</KCChip>);
    expect(getByTestId('chip-dot')).toBeTruthy();
  });

  it('does NOT render dot when dot=false', () => {
    const { queryByTestId } = wrap(<KCChip dot={false}>Sem ponto</KCChip>);
    expect(queryByTestId('chip-dot')).toBeNull();
  });

  it('has alignSelf flex-start via flat style', () => {
    const { UNSAFE_getByType } = wrap(<KCChip>Chip</KCChip>);
    const view = UNSAFE_getByType(require('react-native').View);
    const styleArr = Array.isArray(view.props.style)
      ? view.props.style.filter(Boolean)
      : [view.props.style];
    const merged = Object.assign({}, ...styleArr);
    expect(merged.alignSelf).toBe('flex-start');
  });
});
