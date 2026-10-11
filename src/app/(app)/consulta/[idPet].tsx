import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { avisar, confirmar } from '@components/feedback/confirmar';
import { useToast } from '@components/feedback/Toast';
import { ErrorState } from '@components/feedback/ErrorState';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { voltarOu, fichaDoPet } from '@utils/navegacao';
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
import { lightColors, radius, fontSize } from '@theme/tokens';
import { usePetDetail } from '@hooks/usePetDetail';
import {
  useCriarConsulta,
  useEnviarTranscricao,
  useConfirmarSoap,
} from '@hooks/useEventosClinicos';
import { useIniciarAtendimento } from '@hooks/useAgenda';
import type { SoapDraft } from '@services/eventos-clinicos.service';
import { useAuthStore } from '@store/authStore';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCPetPortrait } from '@components/primitives/KCPetPortrait';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCIcon } from '@components/primitives/KCIcon';
import { LunaSuggestionBadge } from '@components/domain/LunaSuggestionBadge';
import { SeloRascunho, BannerRascunho } from '@components/domain/RascunhoLuna';
import { LancarCobrancaCard } from '@components/domain/LancarCobrancaCard';
import { racaToPalette } from '@utils/mappers';
import { formatDateFull } from '@utils/date';
import { ROUTES } from '@constants/routes';

type Letra = 's' | 'o' | 'a' | 'p';
const LETRAS: Letra[] = ['s', 'o', 'a', 'p'];

// BR-CLI-T08 (C1 medido no G0): a transcrição exige a consulta salva, então a ordem continua
// "salvar, depois gravar". O que saiu foi a exigência de SOAP manual antes de salvar — o vet
// salva só com o motivo e deixa a Luna rascunhar S/O/A/P. Os 4 campos são opcionais no
// backend (`ConsultaCreateDto`, `string?`).
const consultaSchema = z.object({
  dsMotivo: z.string().min(3, 'Informe o motivo da consulta'),
  dsAnamnese: z.string().optional(),
  dsExameFisico: z.string().optional(),
  dsDiagnostico: z.string().optional(),
  dsObservacao: z.string().optional(),
});

type ConsultaForm = z.infer<typeof consultaSchema>;

type SoapField = 'dsAnamnese' | 'dsExameFisico' | 'dsDiagnostico' | 'dsObservacao';

// Um único conjunto S/O/A/P na tela (BR-CLI-03): letra do SOAP ↔ campo do formulário.
const SOAP_CAMPOS: Record<Letra, { campo: SoapField; label: string }> = {
  s: { campo: 'dsAnamnese', label: 'S, subjetivo' },
  o: { campo: 'dsExameFisico', label: 'O, objetivo' },
  a: { campo: 'dsDiagnostico', label: 'A, avaliação' },
  p: { campo: 'dsObservacao', label: 'P, plano' },
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
    petName: { fontFamily: 'Lexend_500Medium', fontSize: fontSize.base, color: colors.text },
    petDate: { fontFamily: 'Lexend_400Regular', fontSize: fontSize.sm, color: colors.textMuteInk },
    form: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 120, gap: 16 },
    // Após salvar o rodapé empilha até 3 botões (descartar, concluir, confirmar): sem folga o último campo fica atrás dele.
    formComRodapeAlto: { paddingBottom: 280 },
    fieldLabel: {
      fontFamily: 'Lexend_500Medium',
      fontSize: fontSize.base,
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
      borderColor: colors.borderControl,
      borderRadius: radius.md,
      padding: 12,
      fontFamily: 'Lexend_400Regular',
      fontSize: fontSize.base,
      color: colors.text,
      textAlignVertical: 'top',
    },
    errorText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: fontSize.sm,
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
      borderRadius: radius.md,
      gap: 12,
    },
    transcricaoTitulo: {
      fontFamily: 'Lexend_500Medium',
      fontSize: fontSize.base,
      color: colors.text,
    },
    transcricaoPreview: {
      fontFamily: 'Lexend_400Regular',
      fontSize: fontSize.sm,
      color: colors.textMuteInk,
      fontStyle: 'italic',
    },
    rascunhoCampo: {
      borderRadius: radius.md,
      borderWidth: 2,
      borderStyle: 'dashed',
      // M-e: amberInk (nao amber): >= 3:1 contra o fundo nos 2 temas (tests/contrast.test.ts).
      borderColor: colors.amberInk,
    },
    transcricaoIndisponivel: {
      fontFamily: 'Lexend_400Regular',
      fontSize: fontSize.sm,
      color: colors.textMuteInk,
    },
  });

const TEXTO_SEM_RASCUNHO = 'A Luna transcreveu, mas não montou o rascunho — preencha os campos abaixo.';

export default function ConsultaScreen() {
  const toast = useToast();
  const { idPet, idAgendamento, nrVersion } = useLocalSearchParams<{
    idPet: string;
    idAgendamento?: string;
    nrVersion?: string;
  }>();
  const petId = idPet ? parseInt(idPet, 10) : null;
  // REC-13: `idAgendamento` só existe quando a tela é aberta pela linha da
  // agenda "Hoje" (ROUTES.app.consulta com o 2º argumento — ver agenda.tsx::
  // handleAbrirProntuario). Sem ele (fluxo antigo, pela ficha do paciente —
  // pacientes/[id].tsx), a mordida do aceite exige NÃO chamar nada.
  const idAgendamentoNum = idAgendamento ? parseInt(idAgendamento, 10) : null;
  const nrVersionNum = nrVersion ? parseInt(nrVersion, 10) : 0;
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

  const { data: pet, isError: petFalhou, refetch: refazerPet } = usePetDetail(petId);
  const { mutate: criarConsulta, isPending } = useCriarConsulta();
  const { mutate: enviarTranscricao, isPending: isEnviandoAudio } = useEnviarTranscricao();
  const { mutate: confirmarSoap, isPending: isConfirmandoSoap } = useConfirmarSoap();
  const { mutate: iniciarAtendimento } = useIniciarAtendimento();

  // REC-13 — marca o início do atendimento no servidor quando o prontuário é
  // aberto pela linha da agenda "Hoje" (idAgendamento presente). O `ref`
  // evita uma 2ª chamada num RE-RENDER com as mesmas deps (é isso que o
  // array de dependências abaixo já garante por construção, já que
  // `idAgendamentoNum`/`nrVersionNum` não mudam durante a vida da tela) —
  // ele NÃO é proteção contra StrictMode, que este app não usa (`git grep
  // "StrictMode" -- src` só acha texto de comentário, nenhum
  // `<React.StrictMode>` real). Numa REMONTAGEM de verdade (o vet sai da
  // tela e volta), o `ref` nasce `false` de novo e a chamada SAI — a
  // proteção contra duplicar `DtInicioAtendimento`/`NrVersion` nesse caso é
  // a idempotência do PRÓPRIO servidor: `IniciarAtendimentoAsync`
  // (AgendaService.cs:472-473) devolve o agendamento atual ANTES de checar
  // versão quando `DtInicioAtendimento` já está preenchido — não sobrescreve
  // o horário, não incrementa `NrVersion`, não falha com 409 mesmo que a
  // versão tenha mudado nesse meio-tempo (G2 REC-13, frente 2).
  //
  // Falha NUNCA bloqueia o prontuário (aceite do backlog: "o vet atende de
  // qualquer jeito"). G2 REC-13 (achado `I-1`): um 409 por `nrVersion`
  // desatualizado (duas recepções/aparelhos tocando o mesmo agendamento)
  // deixava a linha presa em `CHEGOU` na "Hoje" — `dsEtapaRecepcao` só vira
  // `EM_ATENDIMENTO` quando `DtInicioAtendimento` é de fato gravado
  // (CalcularEtapaRecepcao, AgendaService.cs:584) — com o "esperando há N
  // min" (agenda.tsx:463-470) subindo e NENHUM sinal visível, porque
  // `console.warn` sozinho não aparece em build de release. Mesmo padrão já
  // usado NESTE MESMO ARQUIVO para o MESMO 409, na MESMA entidade
  // (`handleChegou`/`handleFaltou`, agenda.tsx:747-752/776-781):
  // `Alert.alert('Agendamento desatualizado', …)`. `console.warn` continua
  // para diagnóstico; qualquer OUTRO erro (422 de status não elegível — ex.:
  // reabrir prontuário de agendamento já `REALIZADO`, guarda de status vem
  // antes da idempotente — ou 404) permanece só `console.warn`, sem Alert:
  // são casos que o G0/G2 já classificaram como inofensivos e não fazem a
  // linha "parecer" ativa quando não está, que é o dano real do 409.
  const jaIniciouAtendimento = useRef(false);
  useEffect(() => {
    if (!idAgendamentoNum || jaIniciouAtendimento.current) return;
    jaIniciouAtendimento.current = true;
    iniciarAtendimento(
      { idAgendamento: idAgendamentoNum, nrVersion: nrVersionNum },
      {
        onError: (err: unknown) => {
          console.warn('[REC-13] Falha ao registrar início de atendimento:', err);
          const apiErr = err as { status?: number };
          if (apiErr.status === 409) {
            void avisar({
              titulo: 'Agendamento desatualizado',
              mensagem: 'Este agendamento foi alterado por outro processo. A lista foi recarregada — confira o estado atual antes de tentar de novo.',
            });
          }
        },
      },
    );
  }, [idAgendamentoNum, nrVersionNum, iniciarAtendimento]);

  const [idEventoClinico, setIdEventoClinico] = useState<number | null>(null);
  const [dsTranscricao, setDsTranscricao] = useState<string | null>(null);
  const [transcricaoIndisponivel, setTranscricaoIndisponivel] = useState(false);
  // M-d: a Luna transcreveu mas nao montou rascunho (diferente de "indisponivel").
  const [semRascunho, setSemRascunho] = useState(false);
  // BR-CLI-T08: os 4 campos do formulário SÃO o único S/O/A/P. `pendentes` = letras cujo texto
  // veio da Luna e o vet ainda não confirmou (selo). `rascunhoLuna` guarda o original da
  // transcrição (LU-10: o badge restaura contra ele). `antesDoRascunho` permite descartar.
  const [pendentes, setPendentes] = useState<Letra[]>([]);
  const [rascunhoLuna, setRascunhoLuna] = useState<SoapDraft>({ s: '', o: '', a: '', p: '' });
  const [antesDoRascunho, setAntesDoRascunho] = useState<Partial<Record<Letra, string>>>({});

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY!);
  const recorderState = useAudioRecorderState(audioRecorder);

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
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
          void avisar({ titulo: 'Erro', mensagem: e?.message ?? 'Não foi possível salvar a consulta' });
        },
      },
    );
  };

  // Preenche os campos com o rascunho. Se o vet já escreveu num campo, pergunta antes de
  // trocar (não perde texto dele em silêncio); recusar preenche só os campos vazios.
  const aplicarRascunho = async (draft: SoapDraft, geradas: Letra[]) => {
    const ocupadas = geradas.filter((l) => (getValues(SOAP_CAMPOS[l].campo) ?? '').trim().length > 0);
    let substituir = true;
    if (ocupadas.length > 0) {
      substituir = await confirmar({
        titulo: 'Substituir o que você escreveu?',
        mensagem: 'A Luna rascunhou campos que você já preencheu. O rascunho entra no lugar do seu texto.',
        verbo: 'Substituir',
        rotuloCancelar: 'Só nos campos vazios',
      });
    }
    const aplicadas = substituir ? geradas : geradas.filter((l) => !ocupadas.includes(l));
    aplicarTextoLuna(aplicadas, draft);
  };

  // I-1 (G2): UNICO ponto de entrada de texto da Luna num campo (transcricao, "Usar rascunho da
  // Luna", "So nos campos vazios"). Invariante: texto da Luna nunca fica num campo sem selo, entao
  // aqui SOMA a `pendentes` (nunca substitui) e guarda o texto do vet so na 1a aplicacao da letra.
  const aplicarTextoLuna = (letras: Letra[], draft: SoapDraft) => {
    const antes: Partial<Record<Letra, string>> = {};
    letras.forEach((l) => {
      antes[l] = getValues(SOAP_CAMPOS[l].campo) ?? '';
      setValue(SOAP_CAMPOS[l].campo, draft[l] ?? '');
    });
    setRascunhoLuna((prev) => {
      // Guarda o rascunho INTEIRO (inclusive letras que o vet recusou trocar): o badge precisa dele.
      const prox = { ...prev };
      LETRAS.forEach((l) => {
        if ((draft[l] ?? '').trim().length > 0) prox[l] = draft[l] ?? '';
      });
      return prox;
    });
    setAntesDoRascunho((prev) => {
      const prox = { ...prev };
      letras.forEach((l) => {
        if (!(l in prox)) prox[l] = antes[l];
      });
      return prox;
    });
    setPendentes((prev) => LETRAS.filter((l) => prev.includes(l) || letras.includes(l)));
  };

  // Descartar devolve cada campo ao que o vet tinha e esquece o rascunho da Luna (o badge some).
  const descartarRascunho = () => {
    pendentes.forEach((l) => setValue(SOAP_CAMPOS[l].campo, antesDoRascunho[l] ?? ''));
    setPendentes([]);
    setAntesDoRascunho({});
    setRascunhoLuna({ s: '', o: '', a: '', p: '' });
  };

  const handleGravarPress = async () => {
    if (recorderState.isRecording) {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      if (uri && idEventoClinico) {
        setTranscricaoIndisponivel(false);
        setSemRascunho(false);
        enviarTranscricao(
          { idEventoClinico, audioUri: uri, mimeType: 'audio/m4a' },
          {
            onSuccess: (result) => {
              // `soap` pode vir `null` (A12: sem OPENAI_API_KEY o backend devolve 200 com
              // transcricao/soap nulos). Nulo NÃO é rascunho vazio: aviso honesto, sem selo.
              const draft: SoapDraft = {
                s: result.soap?.s ?? '',
                o: result.soap?.o ?? '',
                a: result.soap?.a ?? '',
                p: result.soap?.p ?? '',
              };
              const geradas = LETRAS.filter((l) => (draft[l] ?? '').trim().length > 0);
              if (geradas.length === 0) {
                // Transcreveu mas nao montou o rascunho: mostra a transcricao, aviso honesto (M-d).
                if (result.dsTranscricao) {
                  setDsTranscricao(result.dsTranscricao);
                  setSemRascunho(true);
                } else {
                  setTranscricaoIndisponivel(true);
                }
                return;
              }
              setDsTranscricao(result.dsTranscricao);
              void aplicarRascunho(draft, geradas);
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
      void avisar({
        titulo: 'Permissão negada',
        mensagem: 'Autorize o acesso ao microfone para gravar a consulta.',
      });
      return;
    }
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  };

  const handleConfirmarSoap = () => {
    if (!idEventoClinico) return;
    const dto: SoapDraft = {
      s: getValues('dsAnamnese') ?? '',
      o: getValues('dsExameFisico') ?? '',
      a: getValues('dsDiagnostico') ?? '',
      p: getValues('dsObservacao') ?? '',
    };
    confirmarSoap(
      { idEventoClinico, dto },
      {
        onSuccess: () => {
          // O selo só some quando o servidor confirmou: falha deixa o rascunho como rascunho.
          setPendentes([]);
          // I-3: o SOAP vai para DS_SOAP_* e a ficha ainda nao o mostra; o toast so diz o que e verdade.
          toast.show({ tipo: 'sucesso', texto: 'SOAP confirmado' });
          voltarOu(router, fichaDoPet(idPet));
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          void avisar({ titulo: 'Erro', mensagem: e?.message ?? 'Não foi possível confirmar o SOAP' });
        },
      },
    );
  };

  // "Concluir sem confirmar" com rascunho da Luna pendente joga o rascunho fora: pede confirmação.
  const handleConcluirSemConfirmar = async () => {
    if (pendentes.length > 0) {
      const ok = await confirmar({
        titulo: 'Sair sem confirmar o rascunho?',
        mensagem: 'O rascunho da Luna não será salvo no prontuário.',
        verbo: 'Sair sem confirmar',
        destrutivo: true,
        rotuloCancelar: 'Continuar revisando',
      });
      if (!ok) return;
    }
    voltarOu(router, fichaDoPet(idPet));
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
          // FT-08 (regra A5): o DETALHE usa a variante 1080.
          fotoUrl={pet?.dsFotoUrl}
          nome={pet?.nmPet}
        />
        <View style={styles.petInfo}>
          {petFalhou ? (
            // BR-CLI-02: o nome vira "—" sem explicação quando a ficha não carrega.
            <ErrorState
              compacto
              titulo="Não foi possível carregar o paciente"
              onRetry={() => void refazerPet()}
              testID="erro-pet-header"
            />
          ) : (
            <Text style={styles.petName}>{pet?.nmPet ?? '—'}</Text>
          )}
          <Text style={styles.petDate}>{formatDateFull(new Date())}</Text>
        </View>
        <KCIcon name="consult" size={20} color={colors.primary} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={[styles.form, idEventoClinico !== null && styles.formComRodapeAlto]}>
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

          {/* Gravação (TASK-13/14) — só após a consulta ser criada. Não tem mais um 2º S/O/A/P:
              o rascunho entra nos campos abaixo (BR-CLI-03). */}
          {idEventoClinico !== null && (
            <View style={styles.transcricaoCard} testID="card-transcricao">
              <Text style={styles.transcricaoTitulo}>Gravação transcrita (opcional)</Text>

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

              {semRascunho && (
                <Text style={styles.transcricaoIndisponivel} testID="msg-sem-rascunho">
                  {TEXTO_SEM_RASCUNHO}
                </Text>
              )}

              {transcricaoIndisponivel && (
                <Text style={styles.transcricaoIndisponivel} testID="msg-transcricao-indisponivel">
                  Transcrição indisponível no momento — preencha os campos abaixo manualmente.
                </Text>
              )}
            </View>
          )}

          {pendentes.length > 0 && (
            <BannerRascunho testID="banner-rascunho" />
          )}

          {/* Único S/O/A/P */}
          {LETRAS.map((letra) => {
            const { campo, label } = SOAP_CAMPOS[letra];
            const L = letra.toUpperCase() as 'S' | 'O' | 'A' | 'P';
            const rascunho = pendentes.includes(letra);
            return (
              <View key={letra}>
                <View style={styles.labelRow}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  {/* LU-10: restaura o rascunho ORIGINAL da Luna quando o vet divergiu dele. */}
                  <LunaSuggestionBadge
                    campo={L}
                    draftText={rascunhoLuna[letra]}
                    currentText={watch(campo) ?? ''}
                    onSugest={(texto) => aplicarTextoLuna([letra], { ...rascunhoLuna, [letra]: texto })}
                  />
                </View>
                {rascunho && <SeloRascunho testID={`selo-rascunho-${L}`} />}
                <Controller
                  control={control}
                  name={campo}
                  render={({ field: { onChange, value } }) => (
                    <View style={rascunho ? styles.rascunhoCampo : undefined}>
                      <TextInput
                        style={styles.textarea}
                        multiline
                        value={value}
                        onChangeText={onChange}
                        textAlignVertical="top"
                        testID={`field-soap-${letra}`}
                      />
                    </View>
                  )}
                />
                {errors[campo] && <Text style={styles.errorText}>{errors[campo]?.message}</Text>}
              </View>
            );
          })}

          {/* FM-06 (ciclo FIN) — cabe no mesmo gesto de fechar o
              atendimento, mesma fase da transcrição acima (idEventoClinico
              já existe). Opcional e de baixo atrito: concluir sem lançar
              nada continua um caminho de um toque, ver botões do rodapé. */}
          {idEventoClinico !== null && (
            <LancarCobrancaCard idEventoClinico={idEventoClinico} />
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
            {pendentes.length > 0 && (
              <KCButton
                variant="ghost"
                size="lg"
                onPress={descartarRascunho}
                testID="btn-descartar-rascunho"
              >
                Descartar rascunho
              </KCButton>
            )}
            <KCButton
              variant="ghost"
              size="lg"
              onPress={() => void handleConcluirSemConfirmar()}
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
              {pendentes.length > 0 ? 'Confirmar e salvar no prontuário' : 'Confirmar SOAP'}
            </KCButton>
          </>
        )}
      </View>
    </ScreenContainer>
  );
}
