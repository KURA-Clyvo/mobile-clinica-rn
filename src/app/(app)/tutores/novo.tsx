import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCIcon } from '@components/primitives/KCIcon';
import { ROUTES } from '@constants/routes';
import { useCriarTutor } from '@hooks/useTutores';
import { mensagemErroCadastroTutor } from '@services/tutores.service';
import { mascararTelefone, somenteDigitos } from '@utils/telefone';
import { PetForm } from '@components/domain/PetForm';
import { ConviteTutorView } from '@components/domain/ConviteTutorView';
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
    // Estilos da tela de convite (QR/wa.me/copiar link) foram EXTRAÍDOS para
    // ConviteTutorView.tsx (fix wave G2, I-1) — reaproveitado também por
    // pacientes/novo.tsx, não duplicado.
    // ─── Etapa "Cadastrar pet" (REC-04) ───
    petHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
    petHeaderTexto: { fontFamily: 'Lexend_500Medium', fontSize: 18, color: colors.text },
  });

export default function NovoTutorScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();

  // REC-04: a cadeia agora é tutor -> pet -> convite (o convite só aparece
  // no FIM do encadeamento, uma vez). `conviteReservado` guarda o resultado
  // da criação/reemissão do tutor assim que ele chega, mas SÓ é EXIBIDO
  // (etapa==='convite') depois que o pet é salvo — `etapa==='pet'` no meio
  // renderiza o formulário de pet, não o QR.
  type Etapa = 'form' | 'pet' | 'convite';
  const [etapa, setEtapa] = useState<Etapa>('form');
  const [conviteReservado, setConviteReservado] = useState<ConviteTutor | null>(null);

  const { mutate: criar, isPending: salvando } = useCriarTutor();

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
        // REC-04: zera a cadeia inteira (tutor + pet + convite), não só o
        // convite — sem isto, reentrar no meio de um encadeamento
        // abandonado (ex.: operador saiu na etapa "pet") reabriria a etapa
        // "pet" de um tutor que não está mais no estado, órfã.
        setEtapa('form');
        setConviteReservado(null);
        reset();
      };
    }, [reset]),
  );

  // G2b (m8): ponto onde `onSuccess` da criação do tutor decide se aplica o
  // resultado — nunca aplicar quando a tela já perdeu o foco (resposta
  // tardia chegando depois do operador já ter saído). REC-04: avança a
  // etapa (form -> pet). A reemissão de convite (dentro da etapa 'convite',
  // via `ConviteTutorView`) tem seu PRÓPRIO estado/foco — vive naquele
  // componente, não aqui.
  const aplicarCriacaoTutorSeEmFoco = (resultado: ConviteTutor) => {
    if (!emFocoRef.current) return;
    setConviteReservado(resultado);
    setEtapa('pet');
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
        onSuccess: (resultado) => aplicarCriacaoTutorSeEmFoco(resultado),
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

  // REC-04 — etapa "Cadastrar pet": entre a criação do tutor e a exibição do
  // convite. `conviteReservado` já existe neste ponto (foi guardado por
  // `aplicarCriacaoTutorSeEmFoco`) mas NÃO é renderizado ainda — é só
  // contexto (idTutor/nomeTutor) pro PetForm. O convite só aparece depois
  // que `onSuccess` do PetForm dispara `setEtapa('convite')`.
  if (etapa === 'pet' && conviteReservado) {
    return (
      <ScreenContainer keyboardShouldPersistTaps="handled">
        <View style={styles.petHeaderRow}>
          <KCIcon name="check" size={20} color={colors.success} />
          <Text style={styles.petHeaderTexto}>Tutor cadastrado! Agora, o primeiro pet</Text>
        </View>
        <PetForm
          idTutor={conviteReservado.idTutor}
          nomeTutor={conviteReservado.nomeTutor}
          onSuccess={() => setEtapa('convite')}
          onError={(mensagem) => Alert.alert('Não foi possível cadastrar o pet', mensagem)}
        />
        {/* REC-04 fix wave (G2, I-1): antes desta correção não havia como sair
            desta etapa sem abandonar o tutor recém-criado SEM convite algum
            (o tutor fica no servidor, mas a única forma de reemitir o convite
            — POST /tutores/{id}/convite, REC-02 — não tinha gatilho de UI
            alcançável fora da etapa 'convite' de um tutor RECÉM-criado). O
            tutor já está cadastrado nesta etapa — "pular" o pet não perde
            nada que ainda não estivesse perdido; só destrava o convite. */}
        <KCButton
          variant="ghost"
          onPress={() => setEtapa('convite')}
          accessibilityLabel="Pular cadastro do pet e ver o convite do tutor"
          testID="btn-pular-pet"
        >
          Pular pet e ver convite
        </KCButton>
      </ScreenContainer>
    );
  }

  // ─── Tela de convite (estado local — NUNCA uma rota separada, o QR não ───
  // pode ser cacheado nem reaberto por "voltar" do navegador). REC-04: só
  // alcançável depois da etapa "pet" (etapa==='convite') — pelo pet salvo OU
  // por "Pular pet e ver convite" (fix wave G2, I-1) — nunca direto da
  // criação do tutor. Conteúdo/lógica em ConviteTutorView.tsx (compartilhado
  // com pacientes/novo.tsx, não duplicado).
  if (etapa === 'convite' && conviteReservado) {
    return (
      <ConviteTutorView convite={conviteReservado} onConviteAtualizado={setConviteReservado} />
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
