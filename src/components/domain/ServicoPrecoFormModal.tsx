import React, { useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCButton } from '@components/primitives/KCButton';
import { KCTextField } from '@components/primitives/KCTextField';
import { KCIcon } from '@components/primitives/KCIcon';
import { useCriarServicoPreco, useAtualizarServicoPreco } from '@hooks/useServicosPreco';
import type { ServicoPrecoResponse, ApiError } from '../../types/api';

// FM-05 — dois modos, um formulário, mesmo padrão de UsuarioClinicaFormModal
// (FM-02): `servico` presente = edição.
export interface ServicoPrecoFormModalProps {
  visible: boolean;
  onClose: () => void;
  servico?: ServicoPrecoResponse | null;
}

// Preço é digitado como TEXTO (aceita vírgula OU ponto como separador
// decimal -- convenção pt-BR) e convertido para `number` só no submit.
// Replica em zod, para feedback IMEDIATO no cliente, as 3 regras de
// `ServicoPrecoCreateValidator`/`UpdateValidator` (backend-clinica-dotnet
// @94f558d): nome obrigatório <= 200 chars; preço >= 0, <= 99_999_999.99,
// no máximo 2 casas decimais (`NUMBER(10,2)`, `PrecisionScale(10,2)`). O
// backend continua sendo a autoridade -- isto é só UX, não substitui o
// 400 real.
const PRECO_MAXIMO = 99_999_999.99;

function contarCasasDecimais(valorTexto: string): number {
  const normalizado = valorTexto.trim().replace(',', '.');
  const idx = normalizado.indexOf('.');
  return idx === -1 ? 0 : normalizado.length - idx - 1;
}

function paraNumero(valorTexto: string): number {
  return Number(valorTexto.trim().replace(',', '.'));
}

const schema = z.object({
  nmServico: z
    .string()
    .trim()
    .min(1, 'Nome do serviço é obrigatório')
    .max(200, 'Nome do serviço deve ter no máximo 200 caracteres'),
  vlPreco: z
    .string()
    .min(1, 'Informe o preço')
    .refine((v) => !Number.isNaN(paraNumero(v)), 'Informe um número válido')
    .refine((v) => paraNumero(v) >= 0, 'Preço não pode ser negativo')
    .refine((v) => paraNumero(v) <= PRECO_MAXIMO, `Preço deve ser no máximo ${PRECO_MAXIMO}`)
    .refine((v) => contarCasasDecimais(v) <= 2, 'Preço deve ter no máximo 2 casas decimais'),
});

type FormValues = {
  nmServico: string;
  vlPreco: string;
};

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontFamily: 'Lexend_500Medium', fontSize: 15, color: colors.text },
    content: { paddingHorizontal: 16, paddingTop: 16, gap: 16, paddingBottom: 8 },
    footer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
  });

export function ServicoPrecoFormModal({ visible, onClose, servico }: ServicoPrecoFormModalProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const isEdicao = servico != null;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nmServico: servico?.nmServico ?? '',
      vlPreco: servico ? String(servico.vlPreco) : '',
    },
  });

  // Reabre o formulário limpo a cada serviço/visibilidade diferente --
  // mesmo motivo de UsuarioClinicaFormModal (FM-02): sem isto, editar um
  // serviço depois de ter aberto o modal de criação herdaria valores do
  // uso anterior.
  useEffect(() => {
    if (visible) {
      reset({
        nmServico: servico?.nmServico ?? '',
        vlPreco: servico ? String(servico.vlPreco) : '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, servico?.id]);

  const { mutate: criar, isPending: criando } = useCriarServicoPreco();
  const { mutate: atualizar, isPending: atualizando } = useAtualizarServicoPreco();
  const salvando = criando || atualizando;

  const onSubmit = (data: FormValues) => {
    const onError = (err: unknown) => {
      const e = err as ApiError;
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar o serviço');
    };
    const corpo = { nmServico: data.nmServico.trim(), vlPreco: paraNumero(data.vlPreco) };

    if (isEdicao && servico) {
      atualizar(
        { id: servico.id, req: corpo },
        { onSuccess: () => onClose(), onError },
      );
      return;
    }

    criar(corpo, { onSuccess: () => onClose(), onError });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" testID="servico-preco-form-modal-root">
      {visible && (
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {isEdicao ? 'Editar serviço' : 'Novo serviço'}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                testID="btn-fechar-form-servico"
                style={{ padding: 4 }}
              >
                <KCIcon name="close" size={20} color={colors.textMute} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
              <Controller
                control={control}
                name="nmServico"
                render={({ field: { value, onChange, onBlur } }) => (
                  <KCTextField
                    label="Nome do serviço"
                    placeholder="Ex.: Consulta de rotina"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.nmServico?.message}
                    testID="input-nome-servico"
                  />
                )}
              />

              <Controller
                control={control}
                name="vlPreco"
                render={({ field: { value, onChange, onBlur } }) => (
                  <KCTextField
                    label="Preço (R$)"
                    placeholder="Ex.: 150,00"
                    keyboardType="decimal-pad"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.vlPreco?.message}
                    testID="input-preco-servico"
                  />
                )}
              />
            </ScrollView>

            <View style={styles.footer}>
              <KCButton
                variant="primary"
                size="lg"
                loading={salvando}
                disabled={salvando}
                onPress={handleSubmit(onSubmit)}
                testID="btn-salvar-servico"
              >
                {isEdicao ? 'Salvar alterações' : 'Criar serviço'}
              </KCButton>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}
