// BR-CLI-T05 — linha com `Switch`: a LINHA inteira é o alvo de toque (>= 44 de altura, role "switch").
//
// Por quê: o `Switch` do RN/RN-web mede ~40×20 (F6 da auditoria) e não aceita `hitSlop`; deixar só
// ele como alvo reprova 2.5.8. Aqui o `Pressable` da linha alterna o valor; o `Switch` fica como
// representação visual (fora da árvore de acessibilidade e sem receber toque). O `Switch` mantém o
// `testID` informado, então testes continuam disparando `valueChange` nele.
// Regra do gate (`tests/touch-target-coverage.test.ts`): `<Switch>` só pode existir NESTE arquivo.
import React from 'react';
import { Pressable, Switch, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@theme/index';
import { touchTarget } from '@theme/tokens';

export interface KCSwitchRowProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  /** Texto de leitor de tela da linha (o rótulo visível costuma ser `children`). */
  accessibilityLabel: string;
  /** `testID` do `Switch` (os testes existentes miram nele). A linha recebe `${testID}-row`. */
  testID: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function KCSwitchRow({
  value,
  onValueChange,
  accessibilityLabel,
  testID,
  children,
  style,
}: KCSwitchRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value }}
      testID={`${testID}-row`}
      style={[styles.row, style]}
    >
      <View style={styles.conteudo}>{children}</View>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.bgElev}
          testID={testID}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touchTarget.min,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  conteudo: { flex: 1 },
});
