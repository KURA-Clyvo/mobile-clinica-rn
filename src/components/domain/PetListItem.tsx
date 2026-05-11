import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCPetPortrait } from '@components/primitives/KCPetPortrait';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
import { racaToPalette } from '@utils/mappers';
import { calcularIdade } from '@utils/date';
import { STRINGS } from '@constants/strings';
import type { PetResponse } from '../../types/api';

export interface PetListItemProps {
  pet: PetResponse;
  onPress: () => void;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
    },
    info: {
      flex: 1,
      marginLeft: 12,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    name: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
    },
    caption: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
    },
  });

export function PetListItem({ pet, onPress }: PetListItemProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const tutor = pet.tutores[0]?.nmTutor ?? STRINGS.PACIENTES.NO_TUTOR;
  const idade = calcularIdade(pet.dtNascimento);
  const sexo = pet.sgSexo === 'M' ? 'M' : 'F';

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.row}
      accessibilityRole="button"
    >
      <KCPetPortrait palette={racaToPalette(pet.nmRaca)} size={52} ring />
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{pet.nmPet}</Text>
          <KCChip tone="ocean">{pet.nmEspecie}</KCChip>
        </View>
        <Text style={styles.caption}>{pet.nmRaca}</Text>
        <Text style={styles.caption}>{`${idade} · ${sexo}`}</Text>
        <Text style={styles.caption}>{tutor}</Text>
      </View>
      <KCIcon name="chevR" size={16} color={colors.textMute} />
    </TouchableOpacity>
  );
}
