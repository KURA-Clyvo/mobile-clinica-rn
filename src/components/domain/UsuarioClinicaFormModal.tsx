import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCIcon } from '@components/primitives/KCIcon';
import { useCriarUsuarioClinica, useAtualizarUsuarioClinica } from '@hooks/useUsuariosClinica';
import { perfilLabel } from '@utils/perfilUsuario';
import type { TipoPerfilUsuario } from '@utils/perfilUsuario';
import type { UsuarioClinicaResponse, VeterinarioResponse, ApiError } from '../../types/api';

const PAPEIS: TipoPerfilUsuario[] = ['GESTOR', 'VETERINARIO'];

// FM-02 — dois modos, um formulário. `usuario` presente = edição (sem
// campo de senha, ver UsuarioClinicaUpdateRequest — troca de senha é o
// endpoint próprio, PUT /{id}/senha, fora deste modal).
export interface UsuarioClinicaFormModalProps {
  visible: boolean;
  onClose: () => void;
  usuario?: UsuarioClinicaResponse | null;
  veterinarios: VeterinarioResponse[];
}

// dsSenha só existe (e só é exigido) no schema de CRIAÇÃO — replicando a
// regra do backend (UsuarioClinicaCreateDto tem dsSenha; UpdateDto não).
function makeSchema(isEdicao: boolean) {
  const base = {
    dsEmail: z.string().email('Informe um e-mail válido'),
    tpPerfil: z.enum(['GESTOR', 'VETERINARIO']),
    idVeterinario: z.number().nullable(),
  };
  if (isEdicao) return z.object(base);
  return z.object({ ...base, dsSenha: z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres') });
}

type FormValues = {
  dsEmail: string;
  tpPerfil: TipoPerfilUsuario;
  idVeterinario: number | null;
  dsSenha?: string;
};

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
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
    headerTitle: { fontFamily: 'Lexend_500Medium', fontSize: 15, color: colors.text },
    content: { paddingHorizontal: 16, paddingTop: 16, gap: 16, paddingBottom: 8 },
    sectionLabel: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      marginBottom: 8,
    },
    papelRow: { flexDirection: 'row', gap: 10 },
    papelOption: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: 'center',
    },
    papelOptionNormal: { borderColor: colors.border, backgroundColor: colors.surface },
    papelOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '1a' },
    papelOptionText: { fontFamily: 'Lexend_500Medium', fontSize: 14 },
    vetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1.5,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 8,
    },
    vetOptionNormal: { borderColor: colors.border, backgroundColor: colors.surface },
    vetOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '1a' },
    vetOptionText: { fontFamily: 'Lexend_400Regular', fontSize: 14, color: colors.text },
    vetOptionSub: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    errorText: { fontFamily: 'Lexend_400Regular', fontSize: 11, color: colors.danger, marginTop: 4 },
  });

export function UsuarioClinicaFormModal({
  visible,
  onClose,
  usuario,
  veterinarios,
}: UsuarioClinicaFormModalProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const isEdicao = usuario != null;

  const schema = useMemo(() => makeSchema(isEdicao), [isEdicao]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      dsEmail: usuario?.dsEmail ?? '',
      tpPerfil: usuario?.tpPerfil ?? 'VETERINARIO',
      idVeterinario: usuario?.idVeterinario ?? null,
      dsSenha: '',
    },
  });

  // Reabre o formulário limpo a cada usuário/visibilidade diferente — sem
  // isto, editar um usuário depois de ter aberto o modal de criação (ou
  // vice-versa) herdaria valores do uso anterior.
  React.useEffect(() => {
    if (visible) {
      reset({
        dsEmail: usuario?.dsEmail ?? '',
        tpPerfil: usuario?.tpPerfil ?? 'VETERINARIO',
        idVeterinario: usuario?.idVeterinario ?? null,
        dsSenha: '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, usuario?.id]);

  const { mutate: criar, isPending: criando } = useCriarUsuarioClinica();
  const { mutate: atualizar, isPending: atualizando } = useAtualizarUsuarioClinica();
  const salvando = criando || atualizando;

  const onSubmit = (data: FormValues) => {
    const onError = (err: unknown) => {
      const e = err as ApiError;
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar o usuário');
    };

    if (isEdicao && usuario) {
      atualizar(
        {
          id: usuario.id,
          req: { dsEmail: data.dsEmail, tpPerfil: data.tpPerfil, idVeterinario: data.idVeterinario },
        },
        {
          onSuccess: () => {
            onClose();
          },
          onError,
        },
      );
      return;
    }

    criar(
      {
        dsEmail: data.dsEmail,
        dsSenha: data.dsSenha ?? '',
        tpPerfil: data.tpPerfil,
        idVeterinario: data.idVeterinario,
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError,
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" testID="usuario-form-modal-root">
      {visible && (
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {isEdicao ? 'Editar usuário' : 'Novo usuário'}
              </Text>
              <TouchableOpacity onPress={onClose} testID="btn-fechar-form-usuario" style={{ padding: 4 }}>
                <KCIcon name="close" size={20} color={colors.textMute} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              <Controller
                control={control}
                name="dsEmail"
                render={({ field: { value, onChange, onBlur } }) => (
                  <KCTextField
                    label="E-mail"
                    placeholder="pessoa@clinica.com"
                    keyboardType="email-address"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.dsEmail?.message}
                    testID="input-email-usuario"
                  />
                )}
              />

              {!isEdicao && (
                <Controller
                  control={control}
                  name="dsSenha"
                  render={({ field: { value, onChange, onBlur } }) => (
                    <KCTextField
                      label="Senha"
                      placeholder="Mínimo 6 caracteres"
                      secureTextEntry
                      value={value ?? ''}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      error={errors.dsSenha?.message}
                      testID="input-senha-usuario"
                    />
                  )}
                />
              )}

              <View>
                <Text style={styles.sectionLabel}>Papel</Text>
                <Controller
                  control={control}
                  name="tpPerfil"
                  render={({ field: { value, onChange } }) => (
                    <View style={styles.papelRow}>
                      {PAPEIS.map((papel) => {
                        const selecionado = value === papel;
                        return (
                          <TouchableOpacity
                            key={papel}
                            style={[
                              styles.papelOption,
                              selecionado ? styles.papelOptionSelected : styles.papelOptionNormal,
                            ]}
                            onPress={() => onChange(papel)}
                            testID={`chip-papel-${papel.toLowerCase()}`}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: selecionado }}
                          >
                            <Text
                              style={[
                                styles.papelOptionText,
                                { color: selecionado ? colors.primary : colors.text },
                              ]}
                            >
                              {perfilLabel(papel)}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                />
              </View>

              <View>
                <Text style={styles.sectionLabel}>
                  Ficha de veterinário (opcional)
                </Text>
                <Controller
                  control={control}
                  name="idVeterinario"
                  render={({ field: { value, onChange } }) => (
                    <View>
                      <TouchableOpacity
                        style={[
                          styles.vetOption,
                          value === null ? styles.vetOptionSelected : styles.vetOptionNormal,
                        ]}
                        onPress={() => onChange(null)}
                        testID="option-veterinario-nenhum"
                        accessibilityRole="radio"
                        accessibilityState={{ selected: value === null }}
                      >
                        <Text style={styles.vetOptionText}>Nenhuma ficha vinculada</Text>
                      </TouchableOpacity>
                      {veterinarios.map((v) => {
                        const selecionado = value === v.id;
                        return (
                          <TouchableOpacity
                            key={v.id}
                            style={[
                              styles.vetOption,
                              selecionado ? styles.vetOptionSelected : styles.vetOptionNormal,
                            ]}
                            onPress={() => onChange(v.id)}
                            testID={`option-veterinario-${v.id}`}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: selecionado }}
                          >
                            <View>
                              <Text style={styles.vetOptionText}>{v.nmVeterinario}</Text>
                              <Text style={styles.vetOptionSub}>{v.nrCRMV}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                      {veterinarios.length === 0 && (
                        // Estado esperado, não erro: a mordida obrigatória
                        // desta task é justamente criar um usuário SEM
                        // ficha — ver brief FM-02.
                        <Text style={styles.vetOptionSub}>
                          Nenhuma ficha de veterinário cadastrada nesta clínica.
                        </Text>
                      )}
                    </View>
                  )}
                />
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <KCButton
                variant="primary"
                size="lg"
                loading={salvando}
                disabled={salvando}
                onPress={handleSubmit(onSubmit)}
                testID="btn-salvar-usuario"
              >
                {isEdicao ? 'Salvar alterações' : 'Criar usuário'}
              </KCButton>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}
