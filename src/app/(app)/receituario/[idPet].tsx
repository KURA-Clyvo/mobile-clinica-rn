import React, { useState } from 'react';
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
import { useCriarPrescricao, useMedicamentos } from '@hooks/useEventosClinicos';
import { useAuthStore } from '@store/authStore';
import { KCPetPortrait } from '@components/primitives/KCPetPortrait';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCCard } from '@components/primitives/KCCard';
import { racaToPalette } from '@utils/mappers';
import { formatDateShort, formatDateFull } from '@utils/date';
import type { MedicamentoResponse } from '../../../types/api';
import { WhatsAppModal } from '@components/domain/WhatsAppModal';

const prescricaoSchema = z.object({
  idMedicamento: z
    .number({ required_error: 'Selecione um medicamento' })
    .positive('Selecione um medicamento'),
  dsPosologia: z.string().min(5, 'Descreva a posologia'),
  nrDuracaoDias: z
    .number({ required_error: 'Informe a duração' })
    .int()
    .positive()
    .max(365, 'Máximo 365 dias'),
  dtEvento: z.string().min(1, 'Data obrigatória'),
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

  const { data: pet } = usePetDetail(petId);
  const { mutate: criarPrescricao, isPending } = useCriarPrescricao();

  const [buscaMed, setBuscaMed] = useState('');
  const [medSelecionado, setMedSelecionado] = useState<MedicamentoResponse | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showSuccess, setShowSuccess] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);

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
      },
      {
        onSuccess: () => setShowSuccess(true),
        onError: (err: unknown) => {
          const e = err as { message?: string };
          Alert.alert('Erro', e?.message ?? 'Não foi possível emitir a receita');
        },
      },
    );
  };

  const tutor = pet?.tutores[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
          idPet={petId}
          idTutor={tutor.id}
          nmPet={pet?.nmPet ?? ''}
          nmTutor={tutor.nmTutor}
          mensagemDefault={
            medSelecionado
              ? `Olá ${tutor.nmTutor}! Segue a prescrição médica do(a) ${pet?.nmPet}.\n\nMedicamento: ${medSelecionado.nmMedicamento}\n\nQualquer dúvida, estamos à disposição.`
              : undefined
          }
        />
      )}
    </View>
  );
}
