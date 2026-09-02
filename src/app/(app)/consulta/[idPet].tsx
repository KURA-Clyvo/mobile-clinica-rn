import React, { useState, useEffect, useRef } from 'react';
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
import {
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { usePetDetail } from '@hooks/usePetDetail';
import {
  useCriarConsulta,
  useEnviarTranscricao,
  useConfirmarSoap,
} from '@hooks/useEventosClinicos';
import type { SoapDraft } from '@services/eventos-clinicos.service';
import { useAuthStore } from '@store/authStore';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCPetPortrait } from '@components/primitives/KCPetPortrait';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCIcon } from '@components/primitives/KCIcon';
import { LunaSuggestionBadge } from '@components/domain/LunaSuggestionBadge';
import { racaToPalette } from '@utils/mappers';
import { formatDateFull } from '@utils/date';
import { ROUTES } from '@constants/routes';

const SOAP_DRAFT_LABELS: Record<keyof SoapDraft, string> = {
  s: 'Subjetivo',
  o: 'Objetivo',
  a: 'Avaliação',
  p: 'Plano',
};

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
      gap: 8,
    },
    transcricaoCard: {
      marginTop: 8,
      padding: 12,
      backgroundColor: colors.bgElev,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      gap: 12,
    },
    transcricaoTitulo: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 14,
      color: colors.text,
    },
    transcricaoPreview: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.textMute,
      fontStyle: 'italic',
    },
    transcricaoIndisponivel: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.textMute,
    },
  });

export default function ConsultaScreen() {
  const { idPet } = useLocalSearchParams<{ idPet: string }>();
  const petId = idPet ? parseInt(idPet, 10) : null;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);

  // FM-01 — fronteira com o E27 (FIXES_PENDENTES.md:113,895-930): NÃO
  // acrescenta seta de voltar nem mexe em header/layout, isso continua
  // decisão do Felipe (E27 é `DECISÃO`, não `PRONTO`). O que este efeito
  // evita é PIORAR o E27: esconder o botão "Consulta" da ficha do pet
  // (pacientes/[id].tsx) não impede chegar aqui por deep link/URL direta —
  // a plataforma alvo é web, sem botão de voltar dentro da própria página.
  // Sem este redirect, um GESTOR sem ficha que abrisse /consulta/123
  // diretamente veria o formulário inteiro e ficaria PRESO ao tocar
  // "Salvar" (onSubmit faz `if (!petId || !usuario) return` — silêncio).
  // Redireciona para a ficha do pet (ou dashboard, sem petId válido) em vez
  // de renderizar uma tela sem saída.
  // FM-01 fix wave pos-G2 — `jaRedirecionou` existe porque o teste do redirect
  // mediu `router.replace` sendo chamado DUAS vezes, nao uma.
  //
  // A causa: `router` esta nas dependencias, e `useRouter()` nao promete
  // identidade estavel entre renders. Este projeto ja foi mordido pela mesma
  // classe no sentido INVERSO (TASK-70/FIX_6: um `useEffect` dependia de uma
  // funcao do Zustand cuja referencia ERA estavel, entao nunca re-disparava e
  // o registro de push token nunca acontecia no login da sessao em curso).
  // Depender da estabilidade -- ou da instabilidade -- de uma referencia que
  // ninguem documentou e a suposicao, nao o `ref`.
  //
  // O `ref` torna o comportamento correto sob QUALQUER identidade: redireciona
  // exatamente uma vez por montagem. Tirar `router` das dependencias tambem
  // silenciaria o sintoma, mas trocaria uma suposicao por outra.
  const jaRedirecionou = useRef(false);
  useEffect(() => {
    if (!usuario && !jaRedirecionou.current) {
      jaRedirecionou.current = true;
      router.replace(petId ? ROUTES.app.pacienteDetalhe(petId) : ROUTES.app.dashboard);
    }
  }, [usuario, petId, router]);

  const { data: pet } = usePetDetail(petId);
  const { mutate: criarConsulta, isPending } = useCriarConsulta();
  const { mutate: enviarTranscricao, isPending: isEnviandoAudio } = useEnviarTranscricao();
  const { mutate: confirmarSoap, isPending: isConfirmandoSoap } = useConfirmarSoap();

  const [idEventoClinico, setIdEventoClinico] = useState<number | null>(null);
  const [dsTranscricao, setDsTranscricao] = useState<string | null>(null);
  const [transcricaoIndisponivel, setTranscricaoIndisponivel] = useState(false);
  const [soapDraft, setSoapDraft] = useState<SoapDraft>({ s: '', o: '', a: '', p: '' });

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY!);
  const recorderState = useAudioRecorderState(audioRecorder);

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
        onSuccess: (result) => {
          setIdEventoClinico(result.idEventoClinico);
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          Alert.alert('Erro', e?.message ?? 'Não foi possível salvar a consulta');
        },
      },
    );
  };

  const handleGravarPress = async () => {
    if (recorderState.isRecording) {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri && idEventoClinico) {
        setTranscricaoIndisponivel(false);
        enviarTranscricao(
          { idEventoClinico, audioUri: uri, mimeType: 'audio/m4a' },
          {
            onSuccess: (result) => {
              const semSugestao =
                result.dsTranscricao === null &&
                !result.soap.s &&
                !result.soap.o &&
                !result.soap.a &&
                !result.soap.p;
              if (semSugestao) {
                setTranscricaoIndisponivel(true);
                return;
              }
              setDsTranscricao(result.dsTranscricao);
              setSoapDraft({
                s: result.soap.s ?? '',
                o: result.soap.o ?? '',
                a: result.soap.a ?? '',
                p: result.soap.p ?? '',
              });
            },
            // Falha de transcrição: campos seguem editáveis manualmente, sem crash.
            onError: () => setTranscricaoIndisponivel(true),
          },
        );
      }
      return;
    }

    const permissao = await requestRecordingPermissionsAsync();
    if (!permissao.granted) {
      Alert.alert('Permissão negada', 'Autorize o acesso ao microfone para gravar a consulta.');
      return;
    }
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  };

  const handleConfirmarSoap = () => {
    if (!idEventoClinico) return;
    confirmarSoap(
      { idEventoClinico, dto: soapDraft },
      {
        onSuccess: () => {
          Alert.alert('SOAP confirmado', 'O rascunho foi salvo como definitivo.');
          router.back();
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          Alert.alert('Erro', e?.message ?? 'Não foi possível confirmar o SOAP');
        },
      },
    );
  };

  // FM-01, fix wave pos-G2 — a revisao mediu que SEM esta guarda a tela
  // renderiza o formulario INTEIRO antes de o `useEffect` acima disparar o
  // redirect: um GESTOR sem ficha que chegasse aqui por URL direta (a
  // plataforma alvo e web) via, por um quadro, um formulario clinico que ele
  // nao pode submeter. Nao e crash nem tela presa -- e pior de explicar:
  // pisca uma coisa que nao deveria existir para ele.
  //
  // Todos os hooks acima ja rodaram, entao o `return` antecipado aqui NAO
  // viola a regra de ordem de hooks -- a guarda esta deliberadamente no fim,
  // colada ao `return` principal, e nao no topo do componente.
  //
  // ⛔ Isto NAO resolve o E27 (telas sem saida visivel), que continua decisao
  // aberta do Felipe: nada de header, seta de voltar ou `_layout.tsx` foi
  // tocado. O que a guarda faz e nao PIORAR o E27, nao consertá-lo.
  if (!usuario) return null;

  return (
    // CQ-15: `paddingHorizontal={0}` — o header do pet, o form e o rodapé já
    // controlam seu próprio respiro horizontal (cada um com um padding
    // diferente). Ganho real desta migração além do maxWidth: a tela não
    // tinha NENHUM tratamento de safe-area antes (nem topo nem `home
    // indicator`) — o SafeAreaView do ScreenContainer fecha essa lacuna de
    // brinde.
    // CQ-15 fix wave (G2 Important #3, correção de modelo mental): o rodapé
    // abaixo é `position:'absolute', bottom:0` — quando um filho absoluto
    // TEM inset definido (`bottom:0`), o Yoga (RN 0.81.5,
    // ReactCommon/yoga/yoga/algorithm/AbsoluteLayout.cpp:200-210) ancora só
    // pela BORDA do pai, não pelo padding; o `paddingBottom` só entraria em
    // jogo pra um filho absoluto SEM inset (posição estática). Ou seja, o
    // `paddingBottom:24` do modo flat NÃO desloca este rodapé — o
    // `style={{paddingBottom:0}}` que existia aqui antes era inócuo (só
    // deixava o ScrollView interno 24px mais alto, sem efeito visível
    // porque `form` já reserva `paddingBottom:120`) e foi removido. Comparar
    // com `teleorientacao/[idPet].tsx`, cujo rodapé é filho FLEX comum — lá
    // o cancelamento tem efeito real.
    <ScreenContainer scroll={false} paddingHorizontal={0}>
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

          {/* Transcrição por áudio (TASK-13/TASK-14) — só após a consulta ser criada */}
          {idEventoClinico !== null && (
            <View style={styles.transcricaoCard} testID="card-transcricao">
              <Text style={styles.transcricaoTitulo}>Transcrição por áudio (opcional)</Text>

              <KCButton
                variant="secondary"
                iconLeft={
                  <KCIcon
                    name="mic"
                    size={18}
                    color={recorderState.isRecording ? colors.danger : colors.primary}
                  />
                }
                loading={isEnviandoAudio}
                disabled={isEnviandoAudio}
                onPress={handleGravarPress}
                testID="btn-gravar"
              >
                {recorderState.isRecording ? 'Parar gravação' : 'Gravar áudio da consulta'}
              </KCButton>

              {dsTranscricao && (
                <Text style={styles.transcricaoPreview} testID="text-transcricao">
                  {dsTranscricao}
                </Text>
              )}

              {transcricaoIndisponivel && (
                <Text style={styles.transcricaoIndisponivel} testID="msg-transcricao-indisponivel">
                  Transcrição indisponível no momento — preencha os campos abaixo manualmente.
                </Text>
              )}

              {(Object.keys(SOAP_DRAFT_LABELS) as (keyof SoapDraft)[]).map((letra) => (
                <View key={letra}>
                  <Text style={styles.fieldLabel}>{SOAP_DRAFT_LABELS[letra]}</Text>
                  <TextInput
                    style={styles.textarea}
                    multiline
                    value={soapDraft[letra] ?? ''}
                    onChangeText={(texto) =>
                      setSoapDraft((prev) => ({ ...prev, [letra]: texto }))
                    }
                    textAlignVertical="top"
                    testID={`field-soap-${letra}`}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Rodapé */}
      <View style={styles.footer}>
        {idEventoClinico === null ? (
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
        ) : (
          <>
            <KCButton
              variant="ghost"
              size="lg"
              onPress={() => router.back()}
              testID="btn-concluir-sem-soap"
            >
              Concluir sem confirmar SOAP
            </KCButton>
            <KCButton
              variant="primary"
              size="lg"
              loading={isConfirmandoSoap}
              disabled={isConfirmandoSoap}
              onPress={handleConfirmarSoap}
              testID="btn-confirmar-soap"
            >
              Confirmar SOAP
            </KCButton>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}
