import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCButton } from '@components/primitives/KCButton';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
import { useRegisterMutation } from '@hooks/useAuth';
import { STRINGS } from '@constants/strings';
import type { RegisterClinicaRequest } from '../types/api';

const registerSchema = z
  .object({
    nmClinica: z.string().min(2, 'Nome da clínica obrigatório'),
    dsCnpj: z.string().min(14, 'CNPJ deve ter 14 dígitos'),
    dsEmail: z.string().email(STRINGS.VALIDATION.EMAIL_INVALID),
    dsTelefone: z.string().min(10, 'Telefone inválido'),
    dsEndereco: z.string().min(5, 'Endereço obrigatório'),
    nmVeterinarioAdmin: z.string().min(2, 'Nome do veterinário obrigatório'),
    nrCRMV: z.string().min(4, 'CRMV inválido'),
    dsEmailAdmin: z.string().email(STRINGS.VALIDATION.EMAIL_INVALID),
    dsSenhaAdmin: z.string().min(6, STRINGS.VALIDATION.PASSWORD_MIN),
    confirmSenha: z.string(),
  })
  .refine((d) => d.dsSenhaAdmin === d.confirmSenha, {
    message: 'As senhas não coincidem',
    path: ['confirmSenha'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

function getRegisterErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    if ((error as { status: number }).status === 409) {
      return 'E-mail ou CNPJ já cadastrado';
    }
  }
  return STRINGS.AUTH.NETWORK_ERROR;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 24 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
      gap: 12,
    },
    pageTitle: {
      fontFamily: 'Cormorant_500Medium',
      fontSize: 28,
      color: colors.primary,
      flex: 1,
    },
    sectionTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 13,
      color: colors.textMute,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
      marginTop: 24,
    },
    form: { gap: 12 },
    submitBtn: { marginTop: 24 },
    loginLink: { alignItems: 'center', marginTop: 16, marginBottom: 8 },
    loginLinkText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 14,
      color: colors.primary,
    },
  });

export default function RegisterScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { mutate: doRegister, isPending, error } = useRegisterMutation();

  const { control, handleSubmit } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      nmClinica: '',
      dsCnpj: '',
      dsEmail: '',
      dsTelefone: '',
      dsEndereco: '',
      nmVeterinarioAdmin: '',
      nrCRMV: '',
      dsEmailAdmin: '',
      dsSenhaAdmin: '',
      confirmSenha: '',
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    const { confirmSenha: _, ...registerData } = data;
    doRegister(registerData as RegisterClinicaRequest);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.replace('/login')} testID="register-back">
              <KCIcon name="back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.pageTitle}>Cadastrar Clínica</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.sectionTitle}>Dados da Clínica</Text>

            <Controller
              control={control}
              name="nmClinica"
              render={({ field, fieldState }) => (
                <KCTextField
                  label="Nome da Clínica"
                  placeholder="Ex: Clínica Veterinária Kura"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="dsCnpj"
              render={({ field, fieldState }) => (
                <KCTextField
                  label="CNPJ"
                  placeholder="00.000.000/0001-00"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  keyboardType="numeric"
                />
              )}
            />

            <Controller
              control={control}
              name="dsEmail"
              render={({ field, fieldState }) => (
                <KCTextField
                  label="E-mail da Clínica"
                  placeholder="clinica@email.com"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  keyboardType="email-address"
                />
              )}
            />

            <Controller
              control={control}
              name="dsTelefone"
              render={({ field, fieldState }) => (
                <KCTextField
                  label="Telefone"
                  placeholder="(11) 99999-9999"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  keyboardType="phone-pad"
                />
              )}
            />

            <Controller
              control={control}
              name="dsEndereco"
              render={({ field, fieldState }) => (
                <KCTextField
                  label="Endereço"
                  placeholder="Rua, número, bairro, cidade"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />

            <Text style={styles.sectionTitle}>Veterinário Responsável</Text>

            <Controller
              control={control}
              name="nmVeterinarioAdmin"
              render={({ field, fieldState }) => (
                <KCTextField
                  label="Nome do Veterinário"
                  placeholder="Dr(a). Nome Completo"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="nrCRMV"
              render={({ field, fieldState }) => (
                <KCTextField
                  label="CRMV"
                  placeholder="SP-12345"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="dsEmailAdmin"
              render={({ field, fieldState }) => (
                <KCTextField
                  label="E-mail do Veterinário"
                  placeholder="vet@email.com"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  keyboardType="email-address"
                />
              )}
            />

            <Controller
              control={control}
              name="dsSenhaAdmin"
              render={({ field, fieldState }) => (
                <KCTextField
                  label="Senha"
                  placeholder="Mínimo 6 caracteres"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  secureTextEntry
                />
              )}
            />

            <Controller
              control={control}
              name="confirmSenha"
              render={({ field, fieldState }) => (
                <KCTextField
                  label="Confirmar Senha"
                  placeholder="Repita a senha"
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  secureTextEntry
                />
              )}
            />

            {error !== null && (
              <KCChip tone="clay">{getRegisterErrorMessage(error)}</KCChip>
            )}

            <KCButton
              onPress={handleSubmit(onSubmit)}
              loading={isPending}
              style={styles.submitBtn}
            >
              Cadastrar
            </KCButton>

            <TouchableOpacity
              onPress={() => router.replace('/login')}
              style={styles.loginLink}
              testID="register-go-login"
            >
              <Text style={styles.loginLinkText}>Já tenho conta</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
