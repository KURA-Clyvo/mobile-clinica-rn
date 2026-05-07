import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
    title: { fontFamily: 'Lexend_500Medium', fontSize: 18, color: colors.text },
  });

export default function AgendaScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Agenda</Text>
    </View>
  );
}
