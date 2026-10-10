import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { touchTarget } from '@theme/tokens';
import { ThemeProvider } from '@theme/provider';
import { KCTextField } from '@components/primitives/KCTextField';

// BR-CLI-T05: o próprio TextInput tem de ter alvo >= 44 (antes media ~19px no web: o padding
// vertical estava no contêiner e clicar nele não focava o campo).
describe('KCTextField — alvo de toque do campo', () => {
  it('o TextInput tem minHeight >= touchTarget.min', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <KCTextField label="Nome" value="" onChangeText={() => {}} testID="campo" />
      </ThemeProvider>,
    );
    const estilo = StyleSheet.flatten(getByTestId('campo').props.style) ?? {};
    expect(estilo.minHeight).toBeGreaterThanOrEqual(touchTarget.min);
  });
});
