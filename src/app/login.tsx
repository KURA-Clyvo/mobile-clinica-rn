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
import { useLoginMutation } from '@hooks/useAuth';
import { STRINGS } from '@constants/strings';

const loginSchema = z.object({
  dsEmail: z.string().email(STRINGS.VALIDATION.EMAIL_INVALID),
  dsSenha: z.string().min(6, STRINGS.VALIDATION.PASSWORD_MIN),
});

type LoginFormData = z.infer<typeof loginSchema>;

function getLoginErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    if ((error as { status: number }).status === 401) {
      return STRINGS.AUTH.INVALID_CREDENTIALS;
    }
  }
  return STRINGS.AUTH.NETWORK_ERROR;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
    brandBlock: { alignItems: 'center', marginBottom: 48 },
    brand: {
      fontFamily: 'Cormorant_500Medium',
      fontSize: 36,
      color: colors.primary,
      marginTop: 12,
    },
    brandSub: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 14,
      color: colors.textSoft,
      marginTop: 4,
    },
    form: { gap: 16 },
    submitBtn: { marginTop: 8 },
    registerLink: { alignItems: 'center', marginTop: 16 },
    registerLinkText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 14,
      color: colors.primary,
    },
  });

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const { mutate: doLogin, isPending, error } = useLoginMutation();

  const { control, handleSubmit } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { dsEmail: '', dsSenha: '' },
  });

  const onSubmit = (data: LoginFormData) => {
    doLogin(data);
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
          <View style={styles.brandBlock}>
            <KCIcon name="paw" size={48} color={colors.primary} />
            <Text style={styles.brand}>{STRINGS.app.name}</Text>
            <Text style={styles.brandSub}>Acesso veterinário</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="dsEmail"
              render={({ field, fieldState }) => (
                <KCTextField
                  label={STRINGS.auth.email}
                  placeholder={STRINGS.auth.emailPlaceholder}
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
              name="dsSenha"
              render={({ field, fieldState }) => (
                <KCTextField
                  label={STRINGS.auth.senha}
                  placeholder={STRINGS.auth.senhaPlaceholder}
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  error={fieldState.error?.message}
                  secureTextEntry
                />
              )}
            />

            {error !== null && (
              <KCChip tone="clay">{getLoginErrorMessage(error)}</KCChip>
            )}

            <KCButton
              onPress={handleSubmit(onSubmit)}
              loading={isPending}
              style={styles.submitBtn}
            >
              {STRINGS.auth.login}
            </KCButton>

            <TouchableOpacity
              onPress={() => router.push('/register')}
              style={styles.registerLink}
              testID="login-register-link"
            >
              <Text style={styles.registerLinkText}>Cadastrar clínica</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
