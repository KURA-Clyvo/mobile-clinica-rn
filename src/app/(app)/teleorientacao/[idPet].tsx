import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { usePetDetail } from '@hooks/usePetDetail';
import { useAuthStore } from '@store/authStore';
import { KCCard } from '@components/primitives/KCCard';
import { KCButton } from '@components/primitives/KCButton';
import { KCIcon } from '@components/primitives/KCIcon';
import { CFMV_TELEORIENTACAO_BANNER } from '@constants/compliance';

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    bannerCard: {
      marginHorizontal: 16,
      marginTop: 12,
      backgroundColor: colors.infoBg,
      borderColor: colors.info,
      borderWidth: 1.5,
    },
    bannerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    bannerTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.info,
      flex: 1,
    },
    bannerBody: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textSoft,
    },
    ressalvasContainer: { marginTop: 8, gap: 4 },
    ressalvaRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 4,
    },
    ressalvaText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.danger,
      flex: 1,
    },
    vetIdent: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      marginTop: 8,
    },
    videoArea: {
      flex: 1,
      marginHorizontal: 16,
      marginVertical: 12,
      backgroundColor: colors.primary,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    videoTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.textOnPrimary,
      opacity: 0.6,
    },
    videoSubtitle: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textOnPrimary,
      opacity: 0.4,
    },
    notesCard: { marginHorizontal: 16 },
    notesTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
      marginBottom: 8,
    },
    notesInput: {
      minHeight: 80,
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.text,
      textAlignVertical: 'top',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 10,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 8,
      backgroundColor: colors.bgElev,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });

export default function TeleorientacaoScreen() {
  const { idPet } = useLocalSearchParams<{ idPet: string }>();
  const petId = idPet ? parseInt(idPet, 10) : null;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const [notes, setNotes] = useState('');

  const { data: pet } = usePetDetail(petId);
  const tutor = pet?.tutores[0];

  const handleEncerrar = () => {
    Alert.alert(
      'Encerrar sessão?',
      'A sessão de teleorientação será encerrada.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Encerrar', style: 'destructive', onPress: () => router.back() },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Banner CFMV */}
        <KCCard style={styles.bannerCard} testID="cfmv-banner">
          <View style={styles.bannerTitleRow}>
            <KCIcon name="alert" size={18} color={colors.info} />
            <Text style={styles.bannerTitle} testID="cfmv-titulo">
              {CFMV_TELEORIENTACAO_BANNER.titulo}
            </Text>
          </View>
          <Text style={styles.bannerBody} testID="cfmv-corpo">
            {CFMV_TELEORIENTACAO_BANNER.corpo}
          </Text>
          <View style={styles.ressalvasContainer}>
            {CFMV_TELEORIENTACAO_BANNER.ressalvas.map((r, i) => (
              <View key={i} style={styles.ressalvaRow} testID={`cfmv-ressalva-${i}`}>
                <KCIcon name="close" size={12} color={colors.danger} />
                <Text style={styles.ressalvaText}>{r}</Text>
              </View>
            ))}
          </View>
          {usuario && (
            <Text style={styles.vetIdent} testID="cfmv-ident">
              {CFMV_TELEORIENTACAO_BANNER.identificacaoVet(
                usuario.nmVeterinario,
                usuario.nrCRMV,
              )}
            </Text>
          )}
        </KCCard>

        {/* Área de vídeo placeholder */}
        <View style={styles.videoArea} testID="video-area">
          <KCIcon name="cam" size={48} color={colors.textOnPrimary} />
          <Text style={styles.videoTitle}>Chamada de vídeo</Text>
          {pet && tutor && (
            <Text style={styles.videoSubtitle}>{`${pet.nmPet} · ${tutor.nmTutor}`}</Text>
          )}
        </View>

        {/* Painel de notas */}
        <KCCard style={styles.notesCard}>
          <Text style={styles.notesTitle}>Anotações da sessão</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            placeholder="Registre observações durante a sessão..."
            placeholderTextColor={colors.textMute}
            value={notes}
            onChangeText={setNotes}
            testID="notes-input"
          />
        </KCCard>
      </ScrollView>

      {/* Controles */}
      <View style={styles.footer}>
        <KCButton
          variant="secondary"
          size="md"
          style={{ flex: 1 }}
          onPress={() => Alert.alert('Gravação', 'Gravação iniciada (simulado)')}
          testID="btn-gravar"
        >
          Gravar
        </KCButton>
        <KCButton
          variant="danger"
          size="md"
          style={{ flex: 1 }}
          onPress={handleEncerrar}
          testID="btn-encerrar"
        >
          Encerrar
        </KCButton>
      </View>
    </View>
  );
}
