import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
import { useCriarPet } from '@hooks/usePets';
import { ESPECIES, RACAS, racasPorEspecie } from '@constants/catalogoPets';
import { formatDateShort } from '@utils/date';
import type { ApiError, PetResponse } from '../../types/api';

// REC-04 — espelha PetCreateValidator.cs (backend-clinica-dotnet, origin/main
// e33da98): IdEspecie/IdRaca > 0, NmPet não vazio (<=200), DtNascimento <=
// agora, SgSexo em {M,F}, SgPorte em {P,M,G}. dtNascimento validado como
// string ISO não-vazia aqui — a checagem "não é futuro" é reforçada pelo
// `maximumDate` do próprio DateTimePicker (não dá pra escolher data futura na
// UI), mas o zod confere de novo (defesa em profundidade, mesmo padrão do
// resto do app).
const schema = z.object({
  idEspecie: z.number().int().positive('Selecione a espécie'),
  idRaca: z.number().int().positive('Selecione a raça'),
  nmPet: z.string().trim().min(1, 'Informe o nome do pet').max(200),
  dtNascimento: z.string().min(1),
  sgSexo: z.enum(['M', 'F']),
  sgPorte: z.enum(['P', 'M', 'G']),
});

type FormValues = z.infer<typeof schema>;

const UM_ANO_MS = 365 * 24 * 60 * 60 * 1000;

const PORTE_OPCOES: { valor: FormValues['sgPorte']; label: string }[] = [
  { valor: 'P', label: 'Pequeno' },
  { valor: 'M', label: 'Médio' },
  { valor: 'G', label: 'Grande' },
];

const SEXO_OPCOES: { valor: FormValues['sgSexo']; label: string }[] = [
  { valor: 'M', label: 'Macho' },
  { valor: 'F', label: 'Fêmea' },
];

export interface PetFormProps {
  idTutor: number;
  nomeTutor: string;
  onSuccess: (pet: PetResponse) => void;
  onError?: (mensagem: string) => void;
  submitLabel?: string;
  submitTestId?: string;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    section: { gap: 16, paddingBottom: 8 },
    subtitulo: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.textMute,
    },
    sectionLabel: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 13,
      color: colors.text,
      marginBottom: 8,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
    },
    dateText: { fontFamily: 'Lexend_400Regular', fontSize: 15, color: colors.text },
    errorText: { fontFamily: 'Lexend_400Regular', fontSize: 11, color: colors.danger },
  });

/**
 * REC-04 — formulário de cadastro de pet, compartilhado pelos 2 pontos de
 * entrada: o encadeamento tutor->pet->convite (tutores/novo.tsx, tutor
 * RECÉM-criado) e "Adicionar pet a partir de um tutor existente"
 * (pacientes/novo.tsx, tutor escolhido por busca). `idTutor`/`nomeTutor` são
 * CONTEXTO (não campos editáveis do form) — quem monta este componente já
 * sabe a quem o pet pertence.
 *
 * A invalidação de cache (`['pets']`, "paciente novo aparece na lista sem
 * recarregar") mora em `useCriarPet` (usePets.ts), não aqui — mordida
 * própria em tests/usePets.test.ts, para não depender de renderizar toda a
 * árvore desta tela.
 */
export function PetForm({
  idTutor,
  nomeTutor,
  onSuccess,
  onError,
  submitLabel = 'Salvar pet',
  submitTestId = 'btn-salvar-pet',
}: PetFormProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [showPicker, setShowPicker] = useState(false);

  const { mutate: criar, isPending: salvando } = useCriarPet();

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      idEspecie: ESPECIES[0]!.id,
      idRaca: RACAS[0]!.id,
      nmPet: '',
      dtNascimento: new Date(Date.now() - UM_ANO_MS).toISOString(),
      sgSexo: 'M',
      sgPorte: 'M',
    },
  });

  const idEspecieAtual = watch('idEspecie');
  const dtNascimentoAtual = watch('dtNascimento');
  const racasDisponiveis = racasPorEspecie(idEspecieAtual);

  const handleEspecieChange = (idEspecie: number, onChange: (v: number) => void) => {
    onChange(idEspecie);
    // Troca de espécie pode deixar a raça atual órfã (ex.: raça de Cão
    // selecionada, muda pra Gato) — reseta para a 1ª raça válida da nova
    // espécie, nunca deixa idRaca apontando pra uma raça de OUTRA espécie.
    const primeira = racasPorEspecie(idEspecie)[0];
    if (primeira) setValue('idRaca', primeira.id);
  };

  const handleDateChange = (_: unknown, date?: Date) => {
    setShowPicker(false);
    if (date) setValue('dtNascimento', date.toISOString());
  };

  const onSubmit = (data: FormValues) => {
    criar(
      { idTutor, ...data },
      {
        onSuccess: (pet) => onSuccess(pet),
        onError: (err: unknown) => {
          const apiError = err as ApiError;
          const mensagem =
            apiError.status === 400
              ? Object.values(apiError.details ?? {})
                  .flat()
                  .join(' ') || 'Dados inválidos.'
              : apiError.status === 404
                ? 'Tutor não encontrado. Volte e tente novamente.'
                : 'Não foi possível cadastrar o pet. Tente novamente.';
          onError?.(mensagem);
        },
      },
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.subtitulo}>{`Pet de ${nomeTutor}`}</Text>

      <View>
        <Text style={styles.sectionLabel}>Espécie</Text>
        <Controller
          control={control}
          name="idEspecie"
          render={({ field: { value, onChange } }) => (
            <View style={styles.chipRow}>
              {ESPECIES.map((especie) => (
                <KCChip
                  key={especie.id}
                  tone={value === especie.id ? 'ocean' : 'mute'}
                  onPress={() => handleEspecieChange(especie.id, onChange)}
                  testID={`chip-especie-${especie.id}`}
                >
                  {especie.nome}
                </KCChip>
              ))}
            </View>
          )}
        />
      </View>

      <View>
        <Text style={styles.sectionLabel}>Raça</Text>
        <Controller
          control={control}
          name="idRaca"
          render={({ field: { value, onChange } }) => (
            <View style={styles.chipRow}>
              {racasDisponiveis.map((raca) => (
                <KCChip
                  key={raca.id}
                  tone={value === raca.id ? 'ocean' : 'mute'}
                  onPress={() => onChange(raca.id)}
                  testID={`chip-raca-${raca.id}`}
                >
                  {raca.nome}
                </KCChip>
              ))}
            </View>
          )}
        />
      </View>

      <Controller
        control={control}
        name="nmPet"
        render={({ field: { value, onChange, onBlur } }) => (
          <KCTextField
            label="Nome do pet"
            placeholder="Ex.: Rex"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={errors.nmPet?.message}
            testID="input-nome-pet"
          />
        )}
      />

      <View>
        <Text style={styles.sectionLabel}>Data de nascimento</Text>
        <TouchableOpacity
          style={styles.dateRow}
          onPress={() => setShowPicker(true)}
          testID="date-picker-trigger-pet"
        >
          <Text style={styles.dateText}>{formatDateShort(dtNascimentoAtual)}</Text>
          <KCIcon name="agenda" size={18} color={colors.primary} />
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={new Date(dtNascimentoAtual)}
            mode="date"
            maximumDate={new Date()}
            onChange={handleDateChange}
            testID="date-time-picker-pet"
          />
        )}
      </View>

      <View>
        <Text style={styles.sectionLabel}>Sexo</Text>
        <Controller
          control={control}
          name="sgSexo"
          render={({ field: { value, onChange } }) => (
            <View style={styles.chipRow}>
              {SEXO_OPCOES.map((opcao) => (
                <KCChip
                  key={opcao.valor}
                  tone={value === opcao.valor ? 'ocean' : 'mute'}
                  onPress={() => onChange(opcao.valor)}
                  testID={`chip-sexo-${opcao.valor}`}
                >
                  {opcao.label}
                </KCChip>
              ))}
            </View>
          )}
        />
      </View>

      <View>
        <Text style={styles.sectionLabel}>Porte</Text>
        <Controller
          control={control}
          name="sgPorte"
          render={({ field: { value, onChange } }) => (
            <View style={styles.chipRow}>
              {PORTE_OPCOES.map((opcao) => (
                <KCChip
                  key={opcao.valor}
                  tone={value === opcao.valor ? 'ocean' : 'mute'}
                  onPress={() => onChange(opcao.valor)}
                  testID={`chip-porte-${opcao.valor}`}
                >
                  {opcao.label}
                </KCChip>
              ))}
            </View>
          )}
        />
      </View>

      <KCButton
        variant="primary"
        size="lg"
        loading={salvando}
        disabled={salvando}
        onPress={handleSubmit(onSubmit)}
        accessibilityLabel={submitLabel}
        testID={submitTestId}
      >
        {submitLabel}
      </KCButton>
    </View>
  );
}
