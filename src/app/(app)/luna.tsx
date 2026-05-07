import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { STRINGS } from '@constants/strings';

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
    title: { fontFamily: 'Lexend_500Medium', fontSize: 18, color: colors.text },
  });

export default function LunaScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{STRINGS.luna.titulo}</Text>
    </View>
  );
}
