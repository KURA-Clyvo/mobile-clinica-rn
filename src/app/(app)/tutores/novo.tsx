import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCIcon } from '@components/primitives/KCIcon';
import { ROUTES } from '@constants/routes';
import { useCriarTutor, useReemitirConvite } from '@hooks/useTutores';
import { mensagemErroCadastroTutor, mensagemErroReemissaoConvite } from '@services/tutores.service';
import { mascararTelefone, somenteDigitos, linkWhatsApp } from '@utils/telefone';
import type { ApiError, ConviteTutor } from '../../../types/api';

// REC-03 — texto do aviso de privacidade: NÃO EXISTE em lugar nenhum do
// código deste ecossistema (buscado em mobile-tutor-rn, backend-clinica-dotnet,
// backend-tutor-java, kura-landing — ver rec-03-report.md). Resumo curto e
// honesto do que a recepção está confirmando, SEM inventar texto jurídico —
// marcado como provisório de propósito.
const RESUMO_AVISO_PRIVACIDADE =
  'Nome, e-mail e telefone são usados para identificar o tutor e enviar ' +
  'comunicados/lembretes da clínica. Dados de saúde do pet ficam com a clínica.';
const NOTA_AVISO_PROVISORIO =
  'Texto do aviso de privacidade pendente de definição jurídica — este é um resumo provisório.';

const schema = z
  .object({
    nmTutor: z.string().trim().min(3, 'Informe o nome completo'),
    nrCpf: z
      .string()
      .refine((v) => somenteDigitos(v).length === 11, 'CPF precisa ter 11 dígitos'),
    dsEmail: z.string().trim().email('Informe um e-mail válido'),
    // G2 (I-1): teto de 15 dígitos alinhado ao `TetoDigitos` de
    // `NormalizadorTelefone.cs` (E.164) — o piso de 10 já cobre nacional
    // (10-11) e a máscara (`mascararTelefone`) permite até 15 quando há '+'.
    nrTelefone: z
      .string()
      .refine(
        (v) => somenteDigitos(v).length >= 10 && somenteDigitos(v).length <= 15,
        'Informe um telefone válido, com DDD',
      ),
    usaMesmoWhatsapp: z.boolean(),
    dsWhatsapp: z.string().optional(),
    aceitouAvisoPrivacidade: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.usaMesmoWhatsapp) return true;
      const n = somenteDigitos(data.dsWhatsapp ?? '').length;
      return n >= 10 && n <= 15;
    },
    { message: 'Informe um WhatsApp válido, com DDD', path: ['dsWhatsapp'] },
  );

type FormValues = z.infer<typeof schema>;

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    section: { gap: 16, paddingBottom: 8 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 4,
    },
    title: { fontFamily: 'Lexend_500Medium', fontSize: 18, color: colors.text },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4,
    },
    switchLabel: { fontFamily: 'Lexend_400Regular', fontSize: 14, color: colors.text, flex: 1 },
    avisoBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 14,
      backgroundColor: colors.bgSunk,
      gap: 8,
    },
    avisoTexto: { fontFamily: 'Lexend_400Regular', fontSize: 13, color: colors.text, lineHeight: 19 },
    avisoNota: { fontFamily: 'Lexend_400Regular', fontSize: 11, color: colors.textMute, fontStyle: 'italic' },
    checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 5,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxLabel: { flex: 1, fontFamily: 'Lexend_400Regular', fontSize: 13, color: colors.text },
    errorText: { fontFamily: 'Lexend_400Regular', fontSize: 11, color: colors.danger },
    // ─── Tela de convite ───
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

export default function NovoTutorScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();

  const [convite, setConvite] = useState<ConviteTutor | null>(null);

  const { mutate: criar, isPending: salvando } = useCriarTutor();
  const { mutate: reemitir, isPending: reemitindo } = useReemitirConvite();

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nmTutor: '',
      nrCpf: '',
      dsEmail: '',
      nrTelefone: '',
      usaMesmoWhatsapp: true,
      dsWhatsapp: '',
      aceitouAvisoPrivacidade: false,
    },
  });

  const aceitouAviso = watch('aceitouAvisoPrivacidade');
  const usaMesmoWhatsapp = watch('usaMesmoWhatsapp');

  // G2 REC-03 (C-1, Critical): `(app)/_layout.tsx` é um Drawer, e o Drawer do
  // react-navigation v7 NÃO desmonta a tela ao perder o foco (não existe mais
  // `unmountOnBlur`) — sem isto, "Voltar" deixava `convite` vivo no estado, e
  // reentrar em "Novo tutor" reabria o QR/token do tutor ANTERIOR em vez de
  // um formulário vazio (medido com o roteador real, `g2-rec03.md` §F4).
  // `useFocusEffect` roda a função de limpeza quando a tela PERDE o foco —
  // aqui ela zera TUDO (convite + formulário), então a PRÓXIMA vez que a tela
  // ganhar foco (nova visita) começa sempre do zero, independente de o
  // componente continuar montado pelo Drawer.
  //
  // G2b (m8, Minor): o cleanup só roda NO MOMENTO do blur — se a mutação
  // ainda está em voo quando o operador sai pela sidebar (sem passar pelo
  // "Voltar" desta tela) e a resposta chega DEPOIS, com a tela já fora de
  // foco, o `onSuccess` (abaixo) rodava incondicionalmente e repunha o
  // convite no estado; a reentrada mostrava o QR do tutor que acabou de ser
  // salvo (`g2b-rec03.md` §R2, S4). `emFocoRef` é a mesma fonte de verdade
  // que `useFocusEffect` já observa (true logo que a tela ganha foco, false
  // ANTES do cleanup rodar no blur) — os 2 `onSuccess` abaixo checam essa
  // ref e ignoram uma resposta tardia chegando com a tela oculta.
  const emFocoRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      emFocoRef.current = true;
      return () => {
        emFocoRef.current = false;
        setConvite(null);
        reset();
      };
    }, [reset]),
  );

  // G2b (m8): ponto único onde os 2 `onSuccess` (criar/reemitir) decidem se
  // aplicam o resultado — nunca aplicar quando a tela já perdeu o foco
  // (resposta tardia chegando depois do operador já ter saído).
  const aplicarConviteSeEmFoco = (resultado: ConviteTutor) => {
    if (!emFocoRef.current) return;
    setConvite(resultado);
  };

  const onSubmit = (data: FormValues) => {
    // Mordida (c): sem o aceite o formulário nem chega aqui — o botão está
    // desabilitado (ver JSX, disabled={!aceitouAviso}). Este `if` é defesa
    // extra (ex.: submit disparado por Enter em web), não o mecanismo
    // principal de bloqueio.
    if (!data.aceitouAvisoPrivacidade) return;

    criar(
      {
        nmTutor: data.nmTutor,
        nrCpf: data.nrCpf,
        dsEmail: data.dsEmail,
        nrTelefone: data.nrTelefone,
        usaMesmoWhatsapp: data.usaMesmoWhatsapp,
        dsWhatsapp: data.dsWhatsapp,
        aceitouAvisoPrivacidade: data.aceitouAvisoPrivacidade,
      },
      {
        onSuccess: (resultado) => aplicarConviteSeEmFoco(resultado),
        // `err: unknown` (não o `Error` inferido por padrão pelo `useMutation`) —
        // mesmo padrão de usuarios/index.tsx::handleErro: aceitar `unknown` é
        // compatível com o slot `onError` de qualquer TError (contravariância de
        // parâmetro), e é o que permite o cast para `ApiError` logo abaixo sem o
        // TS reclamar de overlap insuficiente (TS2352 — Error x ApiError).
        onError: (err: unknown) => {
          // Mordida (d): 409/500 nunca mostram err.message cru (pode conter
          // CPF/e-mail duplicado — oráculo cross-tenant, ver E46).
          Alert.alert('Não foi possível cadastrar', mensagemErroCadastroTutor(err as ApiError));
        },
      },
    );
  };

  const handleGerarNovoConvite = () => {
    if (!convite) return;
    reemitir(
      { idTutor: convite.idTutor, nomeTutor: convite.nomeTutor, whatsapp: convite.whatsapp },
      {
        onSuccess: (resultado) => aplicarConviteSeEmFoco(resultado),
        // m1 (G2): mensagem genérica pra QUALQUER status ≠ 400, também na
        // reemissão — antes mostrava `err.message` cru (ex.: "Tutor id 42 já
        // possui conta…", 409), texto técnico e nunca pensado pra tela.
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
    if (!convite?.dsLinkConvite) return;
    Linking.openURL(
      linkWhatsApp(convite.whatsapp, mensagemConvite(convite.nomeTutor, convite.dsLinkConvite)),
    );
  };

  const handleCopiarLink = async () => {
    if (!convite?.dsLinkConvite) return;
    await Clipboard.setStringAsync(convite.dsLinkConvite);
    Alert.alert('Copiado', 'Link do convite copiado para a área de transferência.');
  };

  // ─── Tela de convite (estado local — NUNCA uma rota separada, o QR não ───
  // pode ser cacheado nem reaberto por "voltar" do navegador).
  if (convite) {
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

  // ─── Formulário "Novo tutor" ───
  return (
    <ScreenContainer keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.push(ROUTES.app.pacientes)}
            testID="btn-voltar-form-tutor"
            accessibilityLabel="Voltar"
          >
            <KCIcon name="back" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Novo tutor</Text>
        </View>

        <Controller
          control={control}
          name="nmTutor"
          render={({ field: { value, onChange, onBlur } }) => (
            <KCTextField
              label="Nome completo"
              placeholder="Ex.: Ana Beatriz Souza"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.nmTutor?.message}
              testID="input-nome-tutor"
            />
          )}
        />

        <Controller
          control={control}
          name="nrCpf"
          render={({ field: { value, onChange, onBlur } }) => (
            <KCTextField
              label="CPF"
              placeholder="000.000.000-00"
              keyboardType="numeric"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.nrCpf?.message}
              testID="input-cpf-tutor"
            />
          )}
        />

        <Controller
          control={control}
          name="dsEmail"
          render={({ field: { value, onChange, onBlur } }) => (
            <KCTextField
              label="E-mail"
              placeholder="tutor@exemplo.com"
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.dsEmail?.message}
              testID="input-email-tutor"
            />
          )}
        />

        <Controller
          control={control}
          name="nrTelefone"
          render={({ field: { value, onChange, onBlur } }) => (
            <KCTextField
              label="Telefone"
              placeholder="(11) 91234-5678"
              keyboardType="phone-pad"
              value={mascararTelefone(value)}
              onChangeText={(t) => onChange(mascararTelefone(t))}
              onBlur={onBlur}
              error={errors.nrTelefone?.message}
              testID="input-telefone-tutor"
            />
          )}
        />

        <Controller
          control={control}
          name="usaMesmoWhatsapp"
          render={({ field: { value, onChange } }) => (
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>WhatsApp é o mesmo número do telefone</Text>
              <Switch
                value={value}
                onValueChange={onChange}
                testID="switch-mesmo-whatsapp"
                accessibilityLabel="WhatsApp é o mesmo número do telefone"
              />
            </View>
          )}
        />

        {!usaMesmoWhatsapp && (
          <Controller
            control={control}
            name="dsWhatsapp"
            render={({ field: { value, onChange, onBlur } }) => (
              <KCTextField
                label="WhatsApp"
                placeholder="(11) 91234-5678"
                keyboardType="phone-pad"
                value={mascararTelefone(value ?? '')}
                onChangeText={(t) => onChange(mascararTelefone(t))}
                onBlur={onBlur}
                error={errors.dsWhatsapp?.message}
                testID="input-whatsapp-tutor"
              />
            )}
          />
        )}

        <View style={styles.avisoBox}>
          <Text style={styles.avisoTexto}>{RESUMO_AVISO_PRIVACIDADE}</Text>
          <Text style={styles.avisoNota}>{NOTA_AVISO_PROVISORIO}</Text>
        </View>

        <Controller
          control={control}
          name="aceitouAvisoPrivacidade"
          render={({ field: { value, onChange } }) => (
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => onChange(!value)}
              testID="checkbox-aviso-privacidade"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: value }}
              accessibilityLabel="Confirmo que informei o aviso de privacidade ao tutor"
            >
              <View
                style={[
                  styles.checkbox,
                  { borderColor: value ? colors.primary : colors.border, backgroundColor: value ? colors.primary : 'transparent' },
                ]}
              >
                {value && <KCIcon name="check" size={14} color={colors.textOnPrimary} />}
              </View>
              <Text style={styles.checkboxLabel}>
                Confirmo que informei o aviso de privacidade acima ao tutor
              </Text>
            </TouchableOpacity>
          )}
        />

        <KCButton
          variant="primary"
          size="lg"
          loading={salvando}
          disabled={!aceitouAviso || salvando}
          onPress={handleSubmit(onSubmit)}
          accessibilityLabel="Salvar novo tutor"
          testID="btn-salvar-tutor"
        >
          Salvar
        </KCButton>
      </View>
    </ScreenContainer>
  );
}
