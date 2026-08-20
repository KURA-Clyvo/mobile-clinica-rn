import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { usePetDetail } from '@hooks/usePetDetail';
import { useTeleconsulta } from '@hooks/useTeleconsulta';
import { useAuthStore } from '@store/authStore';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCCard } from '@components/primitives/KCCard';
import { KCButton } from '@components/primitives/KCButton';
import { KCIcon } from '@components/primitives/KCIcon';
import { CFMV_TELEORIENTACAO_BANNER } from '@constants/compliance';
import type { ApiError } from '../../../types/api';

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
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
    videoMessage: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.textOnPrimary,
      textAlign: 'center',
      paddingHorizontal: 24,
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
  const { idPet, idAgendamento } = useLocalSearchParams<{ idPet: string; idAgendamento?: string }>();
  const petId = idPet ? parseInt(idPet, 10) : null;
  const agendamentoId = idAgendamento ? parseInt(idAgendamento, 10) : null;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const [notes, setNotes] = useState('');
  const { query: salaQuery, mutation: criarSalaMutation } = useTeleconsulta(agendamentoId);

  const { data: pet } = usePetDetail(petId);
  const tutor = pet?.tutores[0];

  const sala = criarSalaMutation.data ?? salaQuery.data;
  const erro = (criarSalaMutation.error ?? salaQuery.error) as unknown as ApiError | undefined;
  const carregando = salaQuery.isLoading || criarSalaMutation.isPending;

  const handleEntrarNaSala = () => {
    if (sala?.dsSalaUrl) {
      Linking.openURL(sala.dsSalaUrl);
    }
  };

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
    // CQ-15: verificado antes de migrar — apesar de o backlog listar esta
    // tela como candidata a NÃO usar o container ("vídeo em tela cheia"), o
    // vídeo de fato acontece fora do app via `Linking.openURL`
    // (handleEntrarNaSala): o que esta tela renderiza é banner + cartão de
    // status + notas, mesmo padrão de formulário das outras telas migradas.
    // paddingHorizontal={0} porque banner/videoArea/notes/footer já
    // controlam seu próprio respiro horizontal (todos com
    // marginHorizontal/paddingHorizontal: 16 hoje).
    // CQ-15 fix wave (G2 Important #2/#3): diferente de consulta/receituario,
    // o `footer` aqui é filho FLEX comum (sibling do ScrollView, sem
    // `position:'absolute'`) — o `paddingBottom:24` que o modo flat do
    // ScreenContainer aplica por padrão reduz a altura útil do content box e
    // empurra esse rodapé 24px pra cima da borda real, abrindo uma faixa de
    // `colors.bg` sob a barra `bgElev`/`borderTop`. `style={{paddingBottom:0}}`
    // cancela isso. (Em `consulta`/`receituario` o rodapé É absoluto com
    // `bottom:0` — nesse caso o Yoga usa só a borda pra ancorar, não o
    // padding, então lá o mesmo cancelamento é inócuo; ver os comentários
    // daquelas duas telas.)
    <ScreenContainer scroll={false} paddingHorizontal={0} style={{ paddingBottom: 0 }}>
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

        {/* Área de vídeo */}
        <View style={styles.videoArea} testID="video-area">
          {!agendamentoId ? (
            <>
              <KCIcon name="cam" size={48} color={colors.textOnPrimary} />
              <Text style={styles.videoTitle}>Chamada de vídeo</Text>
              <Text style={styles.videoMessage} testID="msg-sem-agendamento">
                Inicie a teleconsulta a partir de um agendamento na Agenda.
              </Text>
            </>
          ) : carregando ? (
            <ActivityIndicator color={colors.textOnPrimary} testID="loading-sala" />
          ) : erro?.status === 422 ? (
            <Text style={styles.videoMessage} testID="msg-sem-consentimento">
              O tutor ainda não registrou consentimento de teleorientação. Peça para ele
              aceitar o termo no app antes de continuar.
            </Text>
          ) : erro ? (
            <>
              <Text style={styles.videoMessage} testID="msg-erro-sala">
                Não foi possível carregar a sala de videochamada.
              </Text>
              <KCButton
                variant="secondary"
                size="sm"
                onPress={() => criarSalaMutation.mutate()}
                testID="btn-tentar-novamente"
              >
                Tentar novamente
              </KCButton>
            </>
          ) : sala?.stFallbackManual ? (
            <Text style={styles.videoMessage} testID="msg-fallback-manual">
              Não foi possível criar a sala automaticamente. Combine um link de
              videochamada manual com o tutor.
            </Text>
          ) : sala?.dsSalaUrl ? (
            <>
              <KCIcon name="cam" size={48} color={colors.textOnPrimary} />
              {pet && tutor && (
                <Text style={styles.videoSubtitle}>{`${pet.nmPet} · ${tutor.nmTutor}`}</Text>
              )}
              <KCButton
                variant="primary"
                size="md"
                onPress={handleEntrarNaSala}
                testID="btn-entrar-sala"
              >
                Entrar na sala
              </KCButton>
            </>
          ) : (
            <>
              <KCIcon name="cam" size={48} color={colors.textOnPrimary} />
              {pet && tutor && (
                <Text style={styles.videoSubtitle}>{`${pet.nmPet} · ${tutor.nmTutor}`}</Text>
              )}
              <KCButton
                variant="primary"
                size="md"
                onPress={() => criarSalaMutation.mutate()}
                testID="btn-iniciar-chamada"
              >
                Iniciar chamada
              </KCButton>
            </>
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
    </ScreenContainer>
  );
}
