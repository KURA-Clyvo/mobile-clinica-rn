import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { usePetDetail } from '@hooks/usePetDetail';
import { useCriarConsulta } from '@hooks/useEventosClinicos';
import { useAuthStore } from '@store/authStore';
import { KCPetPortrait } from '@components/primitives/KCPetPortrait';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCIcon } from '@components/primitives/KCIcon';
import { LunaSuggestionBadge } from '@components/domain/LunaSuggestionBadge';
import { racaToPalette } from '@utils/mappers';
import { formatDateFull } from '@utils/date';

const consultaSchema = z
  .object({
    dsMotivo: z.string().min(3, 'Informe o motivo da consulta'),
    dsAnamnese: z.string().optional(),
    dsExameFisico: z.string().optional(),
    dsDiagnostico: z.string().optional(),
    dsObservacao: z.string().optional(),
  })
  .refine(
    (d) => d.dsAnamnese || d.dsExameFisico || d.dsDiagnostico || d.dsObservacao,
    { message: 'Preencha ao menos um campo SOAP', path: ['dsAnamnese'] },
  );

type ConsultaForm = z.infer<typeof consultaSchema>;

type SoapField = 'dsAnamnese' | 'dsExameFisico' | 'dsDiagnostico' | 'dsObservacao';

const SOAP_LABELS: Record<SoapField, { letra: 'S' | 'O' | 'A' | 'P'; label: string }> = {
  dsAnamnese:   { letra: 'S', label: 'Subjetivo' },
  dsExameFisico: { letra: 'O', label: 'Objetivo' },
  dsDiagnostico: { letra: 'A', label: 'Avaliação' },
  dsObservacao:  { letra: 'P', label: 'Plano' },
};

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    petHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.bgElev,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    petInfo: { flex: 1, marginLeft: 10 },
    petName: { fontFamily: 'Lexend_500Medium', fontSize: 15, color: colors.text },
    petDate: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute },
    form: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120, gap: 16 },
    fieldLabel: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
    },
    labelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    textarea: {
      minHeight: 100,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.text,
      textAlignVertical: 'top',
    },
    errorText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.danger,
      marginTop: 4,
    },
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.bg,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });

export default function ConsultaScreen() {
  const { idPet } = useLocalSearchParams<{ idPet: string }>();
  const petId = idPet ? parseInt(idPet, 10) : null;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);

  const { data: pet } = usePetDetail(petId);
  const { mutate: criarConsulta, isPending } = useCriarConsulta();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ConsultaForm>({
    resolver: zodResolver(consultaSchema),
    defaultValues: {
      dsMotivo: '',
      dsAnamnese: '',
      dsExameFisico: '',
      dsDiagnostico: '',
      dsObservacao: '',
    },
  });

  const watchedValues = watch();

  const onSubmit = (data: ConsultaForm) => {
    if (!petId || !usuario) return;
    criarConsulta(
      {
        idPet: petId,
        idVeterinario: usuario.id,
        dtConsulta: new Date().toISOString(),
        dsMotivo: data.dsMotivo,
        dsAnamnese: data.dsAnamnese,
        dsExameFisico: data.dsExameFisico,
        dsDiagnostico: data.dsDiagnostico,
        dsObservacao: data.dsObservacao,
      },
      {
        onSuccess: () => {
          Alert.alert('Sucesso', 'Consulta registrada');
          router.back();
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          Alert.alert('Erro', e?.message ?? 'Não foi possível salvar a consulta');
        },
      },
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header do pet */}
      <View style={styles.petHeader}>
        <KCPetPortrait
          palette={racaToPalette(pet?.nmRaca ?? '')}
          size={44}
        />
        <View style={styles.petInfo}>
          <Text style={styles.petName}>{pet?.nmPet ?? '—'}</Text>
          <Text style={styles.petDate}>{formatDateFull(new Date())}</Text>
        </View>
        <KCIcon name="consult" size={20} color={colors.primary} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {/* Campo Motivo */}
          <Controller
            control={control}
            name="dsMotivo"
            render={({ field: { onChange, value } }) => (
              <KCTextField
                label="Motivo da consulta *"
                value={value}
                onChangeText={onChange}
                error={errors.dsMotivo?.message}
                testID="field-motivo"
              />
            )}
          />

          {/* Campos SOAP */}
          {(Object.keys(SOAP_LABELS) as SoapField[]).map((fieldKey) => {
            const { letra, label } = SOAP_LABELS[fieldKey];
            return (
              <View key={fieldKey}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <LunaSuggestionBadge
                    campo={letra}
                    idPet={petId ?? 0}
                    currentText={watchedValues[fieldKey]}
                    onSugest={(texto) => setValue(fieldKey, texto)}
                  />
                </View>
                <Controller
                  control={control}
                  name={fieldKey}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={styles.textarea}
                      multiline
                      value={value}
                      onChangeText={onChange}
                      textAlignVertical="top"
                      testID={`field-${fieldKey}`}
                    />
                  )}
                />
                {errors[fieldKey] && (
                  <Text style={styles.errorText}>{errors[fieldKey]?.message}</Text>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Rodapé */}
      <View style={styles.footer}>
        <KCButton
          variant="primary"
          size="lg"
          loading={isPending}
          disabled={isPending}
          onPress={handleSubmit(onSubmit)}
          testID="btn-salvar"
        >
          Salvar consulta
        </KCButton>
      </View>
    </View>
  );
}
