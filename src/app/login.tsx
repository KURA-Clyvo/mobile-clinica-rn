import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCButton } from '@components/primitives/KCButton';
import { KCChip } from '@components/primitives/KCChip';
import { KuraMark } from '@components/brand/KuraMark';
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
    flex: { flex: 1 },
    // CQ-15 fix wave: `paddingVertical: 40` do antigo `scroll`
    // (`flexGrow:1, justifyContent:'center', ...`) não tem equivalente
    // direto no modo scroll do ScreenContainer — ele não expõe override de
    // `contentContainerStyle`, só `style` (aplicado ao próprio ScrollView).
    // Aproximado com marginTop/marginBottom no brandBlock em vez de
    // centralização vertical via flex; não é pixel-idêntico ao layout
    // anterior, registrado aqui em vez de alegado como equivalente.
    brandBlock: { alignItems: 'center', marginTop: 40, marginBottom: 48 },
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

  // CQ-15 fix wave (G2 vetor F — a G2 provou por execução que a alegação
  // anterior aqui era falsa: `ScreenContainer` sempre aceitou um `maxWidth`
  // sobrescrito via `style` no modo flat; o problema real era que isso era
  // capacidade acidental, não API, e não funcionava no modo scroll). Migrada
  // com a prop `maxWidth` explícita nova (~3 linhas em ScreenContainer.tsx),
  // não com a variante que a G2 rejeitou. `maxWidth={480}` — largura de
  // formulário de login/registro, bem menor que `layout.maxContentWidth`
  // (1200px, calibrado para painel de gestão, não formulário centralizado).
  // `KeyboardAvoidingView` continua fora do `ScreenContainer` (que não expõe
  // slot pra isso) — comportamento `behavior={Platform.OS === 'ios' ?
  // 'padding' : 'height'}` verificado contra o código-fonte do
  // react-native-web (KeyboardAvoidingView/index.js): a prop `behavior` é
  // desestruturada e DESCARTADA lá, então o condicional é morto SÓ no alvo
  // web — em iOS/Android nativo o `behavior` tem efeito real. Não é um bug a
  // corrigir, é uma armadilha de leitura documentada.
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <ScreenContainer
        maxWidth={480}
        paddingHorizontal={24}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandBlock}>
          {/* Fix wave da CQ-12 (dev VsClaude, KURA_BACKLOG_CLINICA_1): tela
              de entrada — a marca precisa funcionar como identidade, não
              como ícone de barra, daí 56px (acima do mínimo de 48px do
              brand book, e maior que os 32px do header do NavDrawer, que é
              barra de navegação). Superfície clara (fundo do
              ScreenContainer), então `colors.primary` — knockout
              (`colors.textOnPrimary`) ficaria quase branco aqui e violaria
              contraste (ruling D-3). Aposenta o `KCIcon name="paw"` usado
              antes. */}
          <KuraMark size={56} color={colors.primary} />
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
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}
