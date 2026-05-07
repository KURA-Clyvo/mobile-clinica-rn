import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { KCCard } from '@components/primitives/KCCard';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCChip } from '@components/primitives/KCChip';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { formatTime } from '@utils/date';
import type { AlertaResponse } from '../../types/api';
import type { KCIconName } from '@components/primitives/KCIcon';
import type { ChipTone } from '@components/primitives/KCChip';

export interface AlertCardProps {
  alerta: AlertaResponse;
}

type AlertStyle = { tone: ChipTone; icon: KCIconName; label: string };

function getAlertStyle(tipo: AlertaResponse['dsTipoAlerta']): AlertStyle {
  switch (tipo) {
    case 'VACINA_VENCIDA':
      return { tone: 'amber', icon: 'consult', label: 'Vacina' };
    case 'RETORNO_PENDENTE':
      return { tone: 'amber', icon: 'agenda', label: 'Retorno' };
    case 'EXAME_CRITICO':
      return { tone: 'clay', icon: 'alert', label: 'Exame' };
    case 'IOT_TEMPERATURA':
      return { tone: 'ocean', icon: 'bell', label: 'IoT' };
  }
}

function getToneIconColor(tone: ChipTone, colors: typeof lightColors): { bg: string; icon: string } {
  switch (tone) {
    case 'amber': return { bg: colors.amberPale, icon: colors.amber };
    case 'clay':  return { bg: colors.clayPale, icon: colors.clay };
    case 'ocean': return { bg: colors.primaryPale, icon: colors.primary };
    case 'sage':  return { bg: colors.sagePale, icon: colors.sage };
    case 'mute':  return { bg: colors.bgSunk, icon: colors.textMute };
  }
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    content: { flex: 1, gap: 4 },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    petName: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 13,
      color: colors.text,
      flex: 1,
    },
    time: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 11,
      color: colors.textMute,
    },
    message: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textSoft,
      lineHeight: 17,
    },
    card: { marginBottom: 8 },
  });

export function AlertCard({ alerta }: AlertCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const alertStyle = getAlertStyle(alerta.dsTipoAlerta);
  const toneColors = getToneIconColor(alertStyle.tone, colors);

  return (
    <KCCard style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: toneColors.bg }]}>
          <KCIcon name={alertStyle.icon} size={18} color={toneColors.icon} />
        </View>
        <View style={styles.content}>
          <View style={styles.topRow}>
            {alerta.nmPet ? (
              <Text style={styles.petName} numberOfLines={1} testID="alert-pet-name">
                {alerta.nmPet}
              </Text>
            ) : (
              <KCChip tone={alertStyle.tone}>{alertStyle.label}</KCChip>
            )}
            <Text style={styles.time}>{formatTime(alerta.dtCriacao)}</Text>
          </View>
          <Text style={styles.message} testID="alert-message">{alerta.dsMensagem}</Text>
        </View>
      </View>
    </KCCard>
  );
}
