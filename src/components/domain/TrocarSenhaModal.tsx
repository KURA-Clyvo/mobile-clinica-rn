import React from 'react';
import { View, Text, Modal, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCIcon } from '@components/primitives/KCIcon';
import { useTrocarSenhaUsuarioClinica } from '@hooks/useUsuariosClinica';
import type { ApiError } from '../../types/api';

// FM-02 — PUT /{id}/senha é endpoint PRÓPRIO (administração por um gestor já
// logado, não autosserviço de "esqueci minha senha" — ver escopo negativo do
// brief). Modal separado do formulário de criar/editar de propósito: o corpo
// da rota é { dsSenha }, sozinho — nunca junto de e-mail/papel.
const schema = z.object({
  dsSenha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres'),
});
type FormValues = z.infer<typeof schema>;

export interface TrocarSenhaModalProps {
  visible: boolean;
  onClose: () => void;
  usuarioId: number | null;
  dsEmail: string;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: 'Lexend_500Medium', fontSize: 15, color: colors.text },
    subtitle: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      paddingHorizontal: 16,
      paddingTop: 4,
    },
    content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
    footer: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  });

export function TrocarSenhaModal({ visible, onClose, usuarioId, dsEmail }: TrocarSenhaModalProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { dsSenha: '' } });

  React.useEffect(() => {
    if (visible) reset({ dsSenha: '' });
  }, [visible, reset]);

  const { mutate: trocarSenha, isPending } = useTrocarSenhaUsuarioClinica();

  const onSubmit = (data: FormValues) => {
    if (usuarioId === null) return;
    trocarSenha(
      { id: usuarioId, req: { dsSenha: data.dsSenha } },
      {
        onSuccess: () => {
          Alert.alert('Senha atualizada', `A senha de ${dsEmail} foi alterada.`);
          onClose();
        },
        onError: (err: unknown) => {
          const e = err as ApiError;
          Alert.alert('Erro', e?.message ?? 'Não foi possível trocar a senha');
        },
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" testID="trocar-senha-modal-root">
      {visible && (
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Trocar senha</Text>
              <TouchableOpacity onPress={onClose} testID="btn-fechar-trocar-senha" style={{ padding: 4 }}>
                <KCIcon name="close" size={20} color={colors.textMute} />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>{dsEmail}</Text>

            <View style={styles.content}>
              <Controller
                control={control}
                name="dsSenha"
                render={({ field: { value, onChange, onBlur } }) => (
                  <KCTextField
                    label="Nova senha"
                    placeholder="Mínimo 6 caracteres"
                    secureTextEntry
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.dsSenha?.message}
                    testID="input-nova-senha"
                  />
                )}
              />
            </View>

            <View style={styles.footer}>
              <KCButton
                variant="primary"
                size="lg"
                loading={isPending}
                disabled={isPending}
                onPress={handleSubmit(onSubmit)}
                testID="btn-confirmar-trocar-senha"
              >
                Salvar nova senha
              </KCButton>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}
