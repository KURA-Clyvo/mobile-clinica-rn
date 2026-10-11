import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@theme/index';
import { fontSize, fonts, lightColors, spacing } from '@theme/tokens';

// Kicker do DS (ds-tokens-2026-10-09.json, Mono/kicker): rotulo mono, CAIXA ALTA, precedido de
// filete de 1px, que NOMEIA a funcao do bloco/tela ("PROXIMO ATENDIMENTO"). Regra do DS e do
// ciclo Branding: no maximo 1 por tela, e sempre com funcao (nunca decorativo) —
// `tests/kicker-gate.test.ts` trava o "no maximo 1" por arquivo de tela.
export type KickerCor = 'textMuteInk' | 'textSoft' | 'amberInk';

export interface KickerProps {
  children: string;
  /** Cor do texto e do filete. `textSoft` sobre `primaryPale`; o resto sobre `bg`/`surface`. */
  cor?: KickerCor;
  testID?: string;
}

export function Kicker({ children, cor = 'textMuteInk', testID }: KickerProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const c = colors[cor];
  return (
    <View style={styles.linha} testID={testID}>
      <View style={[styles.filete, { backgroundColor: c }]} />
      <Text style={[styles.texto, { color: c }]} accessibilityRole="header">
        {children.toUpperCase()}
      </Text>
    </View>
  );
}

const makeStyles = (_colors: typeof lightColors) =>
  StyleSheet.create({
    linha: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexShrink: 1 },
    filete: { width: spacing[4], height: 1 },
    // letterSpacing 0.18em do DS sobre 10px = 1.8
    texto: { fontFamily: fonts.mono, fontSize: fontSize.micro, letterSpacing: 1.8, flexShrink: 1 },
  });
