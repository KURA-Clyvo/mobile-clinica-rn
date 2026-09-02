import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Modal,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { usePetDetail } from '@hooks/usePetDetail';
import {
  useCriarPrescricao,
  useMedicamentos,
  useGerarReceituario,
  useBaixarReceituario,
} from '@hooks/useEventosClinicos';
import type { DocumentoResponse } from '@services/eventos-clinicos.service';
import { useAuthStore } from '@store/authStore';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCPetPortrait } from '@components/primitives/KCPetPortrait';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
import { racaToPalette } from '@utils/mappers';
import { formatDateShort, formatDateFull } from '@utils/date';
import { ROUTES } from '@constants/routes';
import type { MedicamentoResponse } from '../../../types/api';
import { WhatsAppModal } from '@components/domain/WhatsAppModal';

const prescricaoSchema = z.object({
  idMedicamento: z
    .number({ error: 'Selecione um medicamento' })
    .positive('Selecione um medicamento'),
  dsPosologia: z.string().min(5, 'Descreva a posologia'),
  nrDuracaoDias: z
    .number({ error: 'Informe a duração' })
    .int()
    .positive()
    .max(365, 'Máximo 365 dias'),
  dtEvento: z.string().min(1, 'Data obrigatória'),
  dsObservacao: z.string().max(1000, 'Máximo 1000 caracteres').optional(),
});

type PrescricaoForm = z.infer<typeof prescricaoSchema>;

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
    sectionLabel: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      marginBottom: 4,
    },
    searchContainer: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    searchInput: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.text,
      padding: 12,
    },
    medItem: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    medName: { fontFamily: 'Lexend_400Regular', fontSize: 15, color: colors.text },
    medSub: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      backgroundColor: colors.surface,
      padding: 12,
    },
    dateText: { fontFamily: 'Lexend_400Regular', fontSize: 15, color: colors.text },
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
    successOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    successCard: {
      backgroundColor: colors.bgElev,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      gap: 12,
    },
    successTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 17,
      color: colors.text,
      textAlign: 'center',
    },
    successSummary: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.textSoft,
      textAlign: 'center',
    },
  });

export default function ReceituarioScreen() {
  const { idPet } = useLocalSearchParams<{ idPet: string }>();
  const petId = idPet ? parseInt(idPet, 10) : null;
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);

  // FM-01 — mesmo raciocínio de consulta/[idPet].tsx: não resolve o E27,
  // só evita PIORÁ-LO. "Emitir receita" é a ÚNICA saída desta tela fora de
  // modal (ver brief da task) — sem este redirect, um GESTOR sem ficha que
  // chegasse aqui por deep link/URL direta ficaria preso: onSubmit faz
  // `if (!petId || !usuario) return` (silêncio), e na web não há botão de
  // voltar do sistema dentro da própria página.
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
  const { mutate: criarPrescricao, isPending: isCriandoPrescricao } = useCriarPrescricao();
  const { mutate: gerarReceituario, isPending: isGerandoReceituario } = useGerarReceituario();
  const { mutate: baixarReceituario, isPending: isBaixandoReceituario } = useBaixarReceituario();

  const [buscaMed, setBuscaMed] = useState('');
  const [medSelecionado, setMedSelecionado] = useState<MedicamentoResponse | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showSuccess, setShowSuccess] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [receituario, setReceituario] = useState<DocumentoResponse | null>(null);
  const [receituarioIndisponivel, setReceituarioIndisponivel] = useState(false);

  const isPending = isCriandoPrescricao || isGerandoReceituario;

  const { data: medsData } = useMedicamentos(buscaMed || undefined);
  const medicamentos = medsData?.items ?? [];
  const filteredMeds = buscaMed
    ? medicamentos.filter((m) =>
        m.nmMedicamento.toLowerCase().includes(buscaMed.toLowerCase()),
      )
    : [];

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PrescricaoForm>({
    resolver: zodResolver(prescricaoSchema),
    defaultValues: {
      idMedicamento: 0,
      dsPosologia: '',
      nrDuracaoDias: 0,
      dtEvento: new Date().toISOString(),
      dsObservacao: '',
    },
  });

  const handleSelectMed = (med: MedicamentoResponse) => {
    setMedSelecionado(med);
    setValue('idMedicamento', med.id);
    setBuscaMed('');
  };

  const handleClearMed = () => {
    setMedSelecionado(null);
    setValue('idMedicamento', 0);
  };

  const handleDateChange = (_: unknown, date?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
      setValue('dtEvento', date.toISOString());
    }
  };

  const onSubmit = (data: PrescricaoForm) => {
    if (!petId || !usuario) return;
    criarPrescricao(
      {
        idPet: petId,
        idVeterinario: usuario.id,
        dtEvento: data.dtEvento,
        idMedicamento: data.idMedicamento,
        dsPosologia: data.dsPosologia,
        nrDuracaoDias: data.nrDuracaoDias,
        dsObservacao: data.dsObservacao,
      },
      {
        onSuccess: (result) => {
          setReceituarioIndisponivel(false);
          gerarReceituario(result.idEventoClinico, {
            onSuccess: (doc) => {
              setReceituario(doc);
              setShowSuccess(true);
            },
            // Falha ao gerar o PDF não bloqueia o vet — a prescrição já foi salva.
            onError: () => {
              setReceituarioIndisponivel(true);
              setShowSuccess(true);
            },
          });
        },
        onError: (err: unknown) => {
          const e = err as { message?: string };
          Alert.alert('Erro', e?.message ?? 'Não foi possível emitir a receita');
        },
      },
    );
  };

  const handleBaixarPdf = () => {
    if (!receituario) return;
    baixarReceituario(
      { idEventoClinico: receituario.idEventoClinico, documento: receituario },
      {
        onError: () => {
          Alert.alert(
            'Erro',
            'Não foi possível baixar o PDF do receituário. Tente novamente.',
          );
        },
      },
    );
  };

  const tutor = pet?.tutores[0];

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
    // CQ-15: mesma decisão da tela de consulta (mesmo padrão estrutural) —
    // paddingHorizontal={0} porque header/form/rodapé já controlam seu
    // próprio respiro.
    // CQ-15 fix wave (G2 Important #3, correção de modelo mental — ver o
    // comentário equivalente em `consulta/[idPet].tsx` para a fonte do
    // Yoga): o rodapé abaixo é `position:'absolute', bottom:0`, então o
    // Yoga ancora pela borda do pai, não pelo padding — `paddingBottom:0`
    // não tinha efeito visível aqui e foi removido.
    <ScreenContainer scroll={false} paddingHorizontal={0}>
      {/* Header do pet */}
      <View style={styles.petHeader}>
        <KCPetPortrait palette={racaToPalette(pet?.nmRaca ?? '')} size={44} />
        <View style={styles.petInfo}>
          <Text style={styles.petName}>{pet?.nmPet ?? '—'}</Text>
          <Text style={styles.petDate}>{formatDateFull(new Date())}</Text>
        </View>
        <KCIcon name="rx" size={20} color={colors.primary} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.form}>
          {/* Medicamento */}
          <View>
            <Text style={styles.sectionLabel}>Medicamento *</Text>
            {medSelecionado ? (
              <KCChip
                tone="ocean"
                onPress={handleClearMed}
                testID="chip-medicamento-selecionado"
              >
                {medSelecionado.nmMedicamento}
              </KCChip>
            ) : (
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar medicamento..."
                  placeholderTextColor={colors.textMute}
                  value={buscaMed}
                  onChangeText={setBuscaMed}
                  testID="search-med"
                />
                {filteredMeds.length > 0 && (
                  <FlatList
                    data={filteredMeds.slice(0, 4)}
                    keyExtractor={(item) => String(item.id)}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.medItem}
                        onPress={() => handleSelectMed(item)}
                        testID={`med-item-${item.id}`}
                      >
                        <Text style={styles.medName}>{item.nmMedicamento}</Text>
                        <Text style={styles.medSub}>
                          {`${item.dsPrincipioAtivo} · ${item.dsConcentracao}`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            )}
            {errors.idMedicamento && (
              <Text style={styles.errorText}>{errors.idMedicamento.message}</Text>
            )}
          </View>

          {/* Posologia */}
          <Controller
            control={control}
            name="dsPosologia"
            render={({ field: { onChange, value } }) => (
              <KCTextField
                label="Posologia *"
                placeholder="Ex: 1 comprimido a cada 12h com alimento"
                value={value}
                onChangeText={onChange}
                error={errors.dsPosologia?.message}
                testID="field-posologia"
              />
            )}
          />

          {/* Duração */}
          <Controller
            control={control}
            name="nrDuracaoDias"
            render={({ field: { onChange, value } }) => (
              <KCTextField
                label="Duração (dias) *"
                placeholder="Ex: 7"
                keyboardType="numeric"
                value={value === 0 ? '' : String(value)}
                onChangeText={(t) => onChange(parseInt(t, 10) || 0)}
                error={errors.nrDuracaoDias?.message}
                testID="field-duracao"
              />
            )}
          />

          {/* Data */}
          <View>
            <Text style={styles.sectionLabel}>Data da prescrição *</Text>
            <TouchableOpacity
              style={styles.dateRow}
              onPress={() => setShowPicker(true)}
              testID="date-picker-trigger"
            >
              <Text style={styles.dateText}>{formatDateShort(selectedDate)}</Text>
              <KCIcon name="agenda" size={18} color={colors.primary} />
            </TouchableOpacity>
            {showPicker && (
              <DateTimePicker
                value={selectedDate}
                mode="date"
                maximumDate={new Date()}
                onChange={handleDateChange}
                testID="date-time-picker"
              />
            )}
            {errors.dtEvento && (
              <Text style={styles.errorText}>{errors.dtEvento.message}</Text>
            )}
          </View>

          {/* Observações (opcional) */}
          <Controller
            control={control}
            name="dsObservacao"
            render={({ field: { onChange, value } }) => (
              <KCTextField
                label="Observações"
                placeholder="Ex: orientar tutor sobre efeitos colaterais"
                multiline
                numberOfLines={4}
                value={value ?? ''}
                onChangeText={onChange}
                error={errors.dsObservacao?.message}
                testID="field-observacao"
              />
            )}
          />
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
          testID="btn-emitir"
        >
          Emitir receita
        </KCButton>
      </View>

      {/* Modal de Sucesso */}
      <Modal visible={showSuccess} transparent animationType="slide" testID="success-modal">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <KCIcon name="check" size={40} color={colors.success} />
            <Text style={styles.successTitle}>Receita emitida com sucesso!</Text>
            {medSelecionado && (
              <Text style={styles.successSummary}>
                {`${medSelecionado.nmMedicamento}`}
              </Text>
            )}
            {receituario && (
              <Text style={styles.successSummary} testID="receituario-pdf-info">
                {`Receituário em PDF gerado (${receituario.nmArquivo})`}
              </Text>
            )}
            {receituarioIndisponivel && (
              <Text style={styles.successSummary} testID="receituario-pdf-indisponivel">
                PDF do receituário indisponível no momento — a prescrição já foi salva.
              </Text>
            )}
            {receituario && (
              <KCButton
                variant="secondary"
                size="md"
                loading={isBaixandoReceituario}
                disabled={isBaixandoReceituario}
                onPress={handleBaixarPdf}
                testID="btn-baixar-pdf"
              >
                Baixar/Visualizar PDF
              </KCButton>
            )}
            <KCButton
              variant="primary"
              size="md"
              onPress={() => { setShowSuccess(false); setShowWhatsApp(true); }}
              testID="btn-whatsapp"
            >
              Enviar via WhatsApp
            </KCButton>
            <KCButton
              variant="ghost"
              size="md"
              onPress={() => { setShowSuccess(false); router.back(); }}
              testID="btn-voltar"
            >
              Voltar ao paciente
            </KCButton>
          </View>
        </View>
      </Modal>

      {/* WhatsApp Modal */}
      {petId && tutor && (
        <WhatsAppModal
          visible={showWhatsApp}
          onClose={() => { setShowWhatsApp(false); router.back(); }}
          nmPet={pet?.nmPet ?? ''}
          nmTutor={tutor.nmTutor}
          dsTelefone={tutor.dsTelefone}
          tipo="receituario"
          mensagemDefault={
            medSelecionado
              ? `Olá ${tutor.nmTutor}! Segue a prescrição médica do(a) ${pet?.nmPet}.\n\nMedicamento: ${medSelecionado.nmMedicamento}\n\nQualquer dúvida, estamos à disposição.`
              : undefined
          }
        />
      )}
    </ScreenContainer>
  );
}
