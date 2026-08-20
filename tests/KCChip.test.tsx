import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { View, TouchableOpacity } from 'react-native';
import { ThemeProvider } from '../src/theme';
import { KCChip, ChipTone } from '../src/components/primitives/KCChip';
import { touchTarget } from '../src/theme/tokens';

function mergedStyle(el: { props: { style: unknown } }) {
  const styleArr = Array.isArray(el.props.style)
    ? el.props.style.filter(Boolean)
    : [el.props.style];
  return Object.assign({}, ...styleArr);
}

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

  // CQ-07 (Bloco 0 §2, B0.5): alvo de toque mínimo 44×44 (WCAG 2.5.8/2.5.5)
  // só quando o chip é interativo — os 12 usos-rótulo do app (`onPress`
  // ausente, `Container` vira `View`) NÃO podem ganhar essa geometria, senão
  // regride 8 telas fora do escopo desta task (ruling do maestro).
  describe('touch target (CQ-07)', () => {
    it('resolves minHeight/minWidth >= 44 when onPress is present (any viewport)', () => {
      const { UNSAFE_getByType } = wrap(<KCChip onPress={() => {}}>7 dias</KCChip>);
      const touchable = UNSAFE_getByType(TouchableOpacity);
      const merged = mergedStyle(touchable);
      expect(merged.minHeight).toBeGreaterThanOrEqual(touchTarget.min);
      expect(merged.minWidth).toBeGreaterThanOrEqual(touchTarget.min);
    });

    it('does NOT resolve minHeight/minWidth when onPress is absent (label chip)', () => {
      const { UNSAFE_getByType } = wrap(<KCChip>Sem toque</KCChip>);
      const view = UNSAFE_getByType(View);
      const merged = mergedStyle(view);
      expect(merged.minHeight).toBeUndefined();
      expect(merged.minWidth).toBeUndefined();
    });
  });
});
