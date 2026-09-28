import React from 'react';
import { View, Text, StyleSheet, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCButton } from '@components/primitives/KCButton';
import { KCIcon } from '@components/primitives/KCIcon';
import { ROUTES } from '@constants/routes';
import { useReemitirConvite } from '@hooks/useTutores';
import { mensagemErroReemissaoConvite } from '@services/tutores.service';
import { linkWhatsApp } from '@utils/telefone';
import type { ApiError, ConviteTutor } from '../../types/api';

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    conviteCentro: { alignItems: 'center', gap: 16, paddingVertical: 8 },
    conviteNome: { fontFamily: 'Lexend_500Medium', fontSize: 17, color: colors.text, textAlign: 'center' },
    conviteSub: { fontFamily: 'Lexend_400Regular', fontSize: 13, color: colors.textMute, textAlign: 'center' },
    qrWrapper: {
      padding: 16,
      backgroundColor: '#FFFFFF',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    semLinkBox: {
      borderWidth: 1,
      borderColor: colors.warning,
      backgroundColor: colors.warningBg,
      borderRadius: 10,
      padding: 14,
      gap: 6,
    },
    semLinkTexto: { fontFamily: 'Lexend_400Regular', fontSize: 13, color: colors.text, lineHeight: 19 },
    acoes: { width: '100%', gap: 10 },
  });

export interface ConviteTutorViewProps {
  convite: ConviteTutor;
  onConviteAtualizado: (novo: ConviteTutor) => void;
}

/**
 * REC-04 fix wave (G2, I-1) — extraído de `tutores/novo.tsx` (REC-03) pra
 * ser REAPROVEITADO, não duplicado, pelos 2 pontos que agora podem mostrar
 * um convite: o encadeamento tutor->pet->convite (`tutores/novo.tsx`,
 * "Pular pet e ver convite" ou pet salvo) e "Gerar convite" a partir de um
 * tutor existente (`pacientes/novo.tsx`, depois do pet salvo). Mesmo
 * conteúdo visual/lógico de sempre — QR nunca cacheado, "Voltar" sempre vai
 * pra pacientes, `useReemitirConvite` próprio (a reemissão daqui em diante é
 * SEMPRE local a este componente, nunca ao pai).
 */
export function ConviteTutorView({ convite, onConviteAtualizado }: ConviteTutorViewProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { mutate: reemitir, isPending: reemitindo } = useReemitirConvite();

  const handleGerarNovoConvite = () => {
    reemitir(
      { idTutor: convite.idTutor, nomeTutor: convite.nomeTutor, whatsapp: convite.whatsapp },
      {
        onSuccess: (resultado) => onConviteAtualizado(resultado),
        // m1 (G2 REC-03): mensagem genérica pra QUALQUER status ≠ 400, também
        // na reemissão — nunca `err.message` cru (ex.: "Tutor id 42 já possui
        // conta…", 409), texto técnico e nunca pensado pra tela.
        onError: (err: unknown) => {
          Alert.alert(
            'Não foi possível gerar novo convite',
            mensagemErroReemissaoConvite(err as ApiError),
          );
        },
      },
    );
  };

  const mensagemConvite = (nomeTutor: string, link: string) =>
    `Olá ${nomeTutor}! Aqui está o link para você baixar o app da clínica e acompanhar seu pet: ${link}`;

  const handleEnviarWhatsApp = () => {
    if (!convite.dsLinkConvite) return;
    Linking.openURL(
      linkWhatsApp(convite.whatsapp, mensagemConvite(convite.nomeTutor, convite.dsLinkConvite)),
    );
  };

  const handleCopiarLink = async () => {
    if (!convite.dsLinkConvite) return;
    await Clipboard.setStringAsync(convite.dsLinkConvite);
    Alert.alert('Copiado', 'Link do convite copiado para a área de transferência.');
  };

  return (
    <ScreenContainer>
      <View style={styles.conviteCentro}>
        <KCIcon name="check" size={40} color={colors.success} />
        <Text style={styles.conviteNome}>{convite.nomeTutor} foi cadastrado(a)!</Text>
        <Text style={styles.conviteSub}>
          Compartilhe o convite abaixo para o tutor baixar o app e criar a conta dele.
        </Text>

        {convite.dsLinkConvite ? (
          <>
            <View style={styles.qrWrapper} testID="convite-qrcode">
              <QRCode value={convite.dsLinkConvite} size={180} />
            </View>
            <View style={styles.acoes}>
              <KCButton
                variant="primary"
                onPress={handleEnviarWhatsApp}
                accessibilityLabel="Enviar convite pelo WhatsApp"
                testID="btn-enviar-whatsapp"
              >
                Enviar pelo WhatsApp
              </KCButton>
              <KCButton
                variant="secondary"
                onPress={handleCopiarLink}
                accessibilityLabel="Copiar link do convite"
                testID="btn-copiar-link"
              >
                Copiar link
              </KCButton>
            </View>
          </>
        ) : (
          <View style={styles.semLinkBox} testID="convite-sem-link">
            <Text style={styles.semLinkTexto}>
              O link do convite ainda não está configurado neste ambiente. Assim que
              estiver disponível, gere um novo convite para obter o QR Code e o link
              de compartilhamento.
            </Text>
          </View>
        )}

        <View style={styles.acoes}>
          <KCButton
            variant="ghost"
            loading={reemitindo}
            disabled={reemitindo}
            onPress={handleGerarNovoConvite}
            accessibilityLabel="Gerar novo convite"
            testID="btn-gerar-novo-convite"
          >
            Gerar novo convite
          </KCButton>
          <KCButton
            variant="secondary"
            onPress={() => router.push(ROUTES.app.pacientes)}
            accessibilityLabel="Voltar para pacientes"
            testID="btn-voltar-pacientes"
          >
            Voltar
          </KCButton>
        </View>
      </View>
    </ScreenContainer>
  );
}
