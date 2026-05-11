import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCCard } from '@components/primitives/KCCard';
import { KCButton } from '@components/primitives/KCButton';
import { KCIcon } from '@components/primitives/KCIcon';
import { useEnviarWhatsApp } from '@hooks/useEventosClinicos';
import type { WhatsAppEnvioRequest } from '../../types/api';

const ATTACHMENT_TYPES: Array<{ tipo: 'PRESCRICAO' | 'PDF' | 'IMAGEM'; label: string }> = [
  { tipo: 'PRESCRICAO', label: 'Prescrição médica' },
  { tipo: 'PDF', label: 'Documento PDF' },
  { tipo: 'IMAGEM', label: 'Imagem' },
];

export interface WhatsAppModalProps {
  visible: boolean;
  onClose: () => void;
  idPet: number;
  idTutor: number;
  nmPet: string;
  nmTutor: string;
  mensagemDefault?: string;
  attachmentDefault?: WhatsAppEnvioRequest['attachments'];
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
    },
    content: { paddingHorizontal: 16, paddingTop: 16, gap: 16, paddingBottom: 8 },
    recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    recipientName: { fontFamily: 'Lexend_500Medium', fontSize: 15, color: colors.text },
    recipientPet: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute },
    sectionLabel: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      marginBottom: 4,
    },
    messageInput: {
      minHeight: 120,
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.text,
      textAlignVertical: 'top',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
    },
    charCount: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      alignSelf: 'flex-end',
      marginTop: 2,
    },
    attachmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 4,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    attachmentLabel: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.text,
    },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });

export function WhatsAppModal({
  visible,
  onClose,
  idPet,
  idTutor,
  nmPet,
  nmTutor,
  mensagemDefault,
  attachmentDefault,
}: WhatsAppModalProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const defaultMsg =
    mensagemDefault ??
    `Olá ${nmTutor}! Segue a prescrição médica do(a) ${nmPet}.\n\nQualquer dúvida, estamos à disposição.`;

  const [mensagem, setMensagem] = useState(defaultMsg);
  const [selectedAttachments, setSelectedAttachments] = useState<
    Array<'PRESCRICAO' | 'PDF' | 'IMAGEM'>
  >(attachmentDefault?.map((a) => a.tipo) ?? []);

  const { mutate: enviar, isPending } = useEnviarWhatsApp();

  const toggleAttachment = (tipo: 'PRESCRICAO' | 'PDF' | 'IMAGEM') => {
    setSelectedAttachments((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo],
    );
  };

  const handleSend = () => {
    const req: WhatsAppEnvioRequest = {
      idPet,
      idTutor,
      dsMensagem: mensagem,
      attachments: selectedAttachments.map((tipo) => ({ tipo, url: '' })),
    };
    enviar(req, {
      onSuccess: () => {
        Alert.alert('Mensagem enviada!');
        onClose();
      },
      onError: () => {
        Alert.alert('Falha ao enviar. Tente novamente.');
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" testID="whatsapp-modal-root">
      {visible && (
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Enviar via WhatsApp</Text>
              <TouchableOpacity
                onPress={onClose}
                testID="btn-fechar-whatsapp"
                style={{ padding: 4 }}
              >
                <KCIcon name="close" size={20} color={colors.textMute} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              <KCCard>
                <View style={styles.recipientRow}>
                  <KCIcon name="patients" size={20} color={colors.primary} />
                  <View>
                    <Text style={styles.recipientName} testID="recipient-tutor">
                      {nmTutor}
                    </Text>
                    <Text style={styles.recipientPet} testID="recipient-pet">
                      {nmPet}
                    </Text>
                  </View>
                </View>
              </KCCard>

              <View>
                <Text style={styles.sectionLabel}>Mensagem *</Text>
                <TextInput
                  style={styles.messageInput}
                  multiline
                  placeholder="Digite ou edite a mensagem..."
                  placeholderTextColor={colors.textMute}
                  value={mensagem}
                  onChangeText={(t) => setMensagem(t.slice(0, 500))}
                  testID="message-input"
                />
                <Text
                  style={styles.charCount}
                  testID="char-count"
                >{`${mensagem.length}/500`}</Text>
              </View>

              <View>
                <Text style={styles.sectionLabel}>Anexos</Text>
                {ATTACHMENT_TYPES.map(({ tipo, label }) => {
                  const checked = selectedAttachments.includes(tipo);
                  return (
                    <TouchableOpacity
                      key={tipo}
                      style={styles.attachmentRow}
                      onPress={() => toggleAttachment(tipo)}
                      testID={`attachment-${tipo}`}
                    >
                      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                        {checked && (
                          <KCIcon name="check" size={12} color={colors.textOnPrimary} />
                        )}
                      </View>
                      <Text style={styles.attachmentLabel}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <KCButton
                variant="primary"
                size="lg"
                loading={isPending}
                disabled={isPending || mensagem.trim().length === 0}
                onPress={handleSend}
                testID="btn-enviar-whatsapp"
              >
                Enviar mensagem
              </KCButton>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}
