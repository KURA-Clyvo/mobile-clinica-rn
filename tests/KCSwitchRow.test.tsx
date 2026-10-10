// BR-CLI-T05 fix wave (G2 I-2/I-3) — KCSwitchRow acessível.
// Jest roda com o host nativo (não DOM): este teste prova as PROPS que o RN-web converte em atributo
// (`aria-checked`, `aria-hidden`) e o handler de teclado; a prova no DOM real (Tab, Espaço, `inert`, sem scroll)
// está na sonda `scripts/shots/br-cli-t05-fixwave-switch.mjs` (workspace), registrada no relatório.
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { lightColors, darkColors } from '../src/theme/tokens';
import { KCSwitchRow } from '../src/components/primitives/KCSwitchRow';
import { Text, Switch } from 'react-native';

function montar(value: boolean, onValueChange = jest.fn()) {
  const r = render(
    <ThemeProvider>
      <KCSwitchRow value={value} onValueChange={onValueChange} accessibilityLabel="Notificações" testID="sw">
        <Text>Notificações</Text>
      </KCSwitchRow>
    </ThemeProvider>,
  );
  return { ...r, onValueChange };
}

describe('KCSwitchRow', () => {
  it.each([true, false])('a linha expõe o estado: aria-checked=%s (RN-web não mapeia accessibilityState)', (v) => {
    // Props do `Pressable` (composite): é o que o RN-web converte em atributo DOM. O host nativo já traduz
    // `aria-checked` para `accessibilityState`, então a asserção precisa ser feita na camada do componente.
    const { UNSAFE_queryAllByProps, getByTestId } = montar(v);
    expect(UNSAFE_queryAllByProps({ testID: 'sw-row', 'aria-checked': v }).length).toBeGreaterThan(0);
    expect(getByTestId('sw-row').props.accessibilityRole).toBe('switch');
  });

  it('Espaço alterna e NÃO deixa a página rolar (preventDefault); outras teclas não alternam', () => {
    const { getByTestId, onValueChange } = montar(false);
    const linha = getByTestId('sw-row');
    const preventDefault = jest.fn();
    fireEvent(linha, 'keyDown', { key: ' ', preventDefault });
    expect(onValueChange).toHaveBeenCalledWith(true);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    onValueChange.mockClear();
    fireEvent(linha, 'keyDown', { key: 'a', preventDefault });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('o toque na linha alterna (Enter/clique ficam com o PressResponder)', () => {
    const { getByTestId, onValueChange } = montar(true);
    fireEvent.press(getByTestId('sw-row'));
    expect(onValueChange).toHaveBeenCalledWith(false);
  });

  it('o Switch interno sai da árvore de acessibilidade (wrapper aria-hidden + no-hide-descendants)', () => {
    const { UNSAFE_getByType } = montar(false);
    const sw = UNSAFE_getByType(Switch);
    const wrapper = sw.parent as unknown as { props: Record<string, unknown> };
    expect(wrapper.props['aria-hidden']).toBe(true);
    expect(wrapper.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(wrapper.props.accessibilityElementsHidden).toBe(true);
  });

  it('I-3: trilho desligado usa borderControl (o tema vem do ThemeProvider), não border', () => {
    const { UNSAFE_getByType } = montar(false);
    const track = (UNSAFE_getByType(Switch).props.trackColor as { false: string }).false;
    expect([lightColors.borderControl, darkColors.borderControl]).toContain(track);
    expect([lightColors.border, darkColors.border]).not.toContain(track);
  });
});
