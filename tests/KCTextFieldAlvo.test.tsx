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

  // M-6 (re-G2): a caixa multilinha media 116px antes da migracao do padding para o input e passou a 102.
  // Conteudo 90 + padding vertical 12*2 (agora dentro do input) = 114 => caixa 116 com a borda de 1.5*2.
  it('multilinha preserva a altura de 90 de conteudo + 24 de padding (caixa 116 como antes)', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <KCTextField label="Obs" value="" onChangeText={() => {}} testID="campo" multiline />
      </ThemeProvider>,
    );
    const estilo = StyleSheet.flatten(getByTestId('campo').props.style) ?? {};
    expect(estilo.minHeight).toBe(90 + 2 * (estilo.paddingVertical as number));
    expect(estilo.minHeight).toBe(114);
  });
});
