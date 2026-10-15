import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KCCard } from '@components/primitives/KCCard';
import { KCIcon } from '@components/primitives/KCIcon';
import { useTheme } from '@theme/index';
import { lightColors, fontSize, radius } from '@theme/tokens';
import type { KCIconName } from '@components/primitives/KCIcon';

export type MetricTone = 'ocean' | 'sage' | 'amber' | 'clay';

export interface MetricCardProps {
  label: string;
  // FM-07 — ampliado de `number` para `number | string` (decisão declarada: estender o
  // componente COMPARTILHADO em vez de duplicá-lo num irmão, ver dashboard.tsx). Mudança
  // ADITIVA: os 4 consumidores existentes (dashboard.tsx, todos numéricos) continuam
  // passando `number` sem alteração nenhuma — `<Text>` renderiza `number` e `string` de
  // forma idêntica. Necessário porque os cards financeiros (FM-07) precisam de valor JÁ
  // FORMATADO (`formatarMoeda()`, ex.: "R$ 1.234,56") ou do traço "—" para `ticketMedio:
  // null` — nenhum dos dois é `number`.
  value: number | string;
  icon: KCIconName;
  tone: MetricTone;
}

function getToneColors(tone: MetricTone, colors: typeof lightColors) {
  switch (tone) {
    case 'ocean': return { bg: colors.primaryPale, icon: colors.primary };
    case 'sage':  return { bg: colors.sagePale, icon: colors.sage };
    case 'amber': return { bg: colors.amberPale, icon: colors.amber };
    case 'clay':  return { bg: colors.clayPale, icon: colors.clay };
  }
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    card: { flex: 1 },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    value: {
      fontFamily: 'Cormorant_500Medium',
      fontSize: fontSize['2xl'],
      color: colors.text,
      lineHeight: 36,
    },
    label: {
      fontFamily: 'Lexend_400Regular',
      fontSize: fontSize.xs,
      color: colors.textMuteInk,
      marginTop: 2,
    },
  });

// Largura média de um caractere do valor, em em (Cormorant, dígitos e pontuação). Margem de
// segurança incluída: errar para MAIS só reduz um pouco a fonte, errar para menos parte o número.
const LARGURA_MEDIA_EM = 0.5;
const FONTE_MINIMA = 14;

/** Tamanho de fonte em que `texto` cabe em UMA linha na `largura` medida (G4 BR-CLI-G4, BR-T09-MC:
 *  "R$ 4.820,50" partia em "R$ 4.820,5" / "0" -- valor monetário nunca pode partir no meio). */
export function fonteQueCabe(texto: string, largura: number | null, base: number): number {
  if (largura == null || largura <= 0 || texto.length === 0) return base;
  const cabe = Math.floor(largura / (texto.length * LARGURA_MEDIA_EM));
  return Math.max(FONTE_MINIMA, Math.min(base, cabe));
}

export function MetricCard({ label, value, icon, tone }: MetricCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const toneColors = getToneColors(tone, colors);
  const [largura, setLargura] = useState<number | null>(null);
  const texto = String(value);
  const tamanho = fonteQueCabe(texto, largura, fontSize['2xl']);

  return (
    <KCCard style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: toneColors.bg }]}>
        <KCIcon name={icon} size={20} color={toneColors.icon} />
      </View>
      <Text
        style={[styles.value, tamanho < fontSize['2xl'] ? { fontSize: tamanho } : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.5}
        onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
        testID="metric-value"
      >
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={2} testID="metric-label">{label}</Text>
    </KCCard>
  );
}
