import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCButton } from '@components/primitives/KCButton';
import { KCIcon } from '@components/primitives/KCIcon';
import { useAtualizarStatusAgendamento } from '@hooks/useAgenda';
import { getTransicoesPermitidas } from '@services/agenda.service';
import type { StatusDestino } from '@services/agenda.service';
import type { ApiError } from '../../types/api';

export interface AgendamentoStatusMenuProps {
  visible: boolean;
  onClose: () => void;
  idAgendamento: number;
  nrVersion: number;
  dsStatusOrigem: string;
  nmPet: string;
}

// FM-04 — Ruling D-13: a ação mora na própria agenda, num menu contextual que
// oferece só os destinos que a máquina de estados permite a partir do status
// ATUAL (dsStatusOrigem, não sgStatus traduzido — ver comentário em
// AgendamentoResponse, types/api.ts). Rótulos em primeira pessoa do
// veterinário (ação a executar), não o nome do estado resultante — para não
// obrigar quem usa a tela a traduzir "REALIZADO" mentalmente.
const DESTINO_LABEL: Record<StatusDestino, string> = {
  CONFIRMADO: 'Confirmar agendamento',
  REALIZADO: 'Marcar como realizado',
  NAO_COMPARECEU: 'Marcar não compareceu',
  CANCELADO: 'Cancelar agendamento',
};

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.bg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
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
    headerTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
    },
    content: { paddingHorizontal: 16, paddingTop: 16, gap: 10, paddingBottom: 8 },
    emptyText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.textMute,
    },
  });

export function AgendamentoStatusMenu({
  visible,
  onClose,
  idAgendamento,
  nrVersion,
  dsStatusOrigem,
  nmPet,
}: AgendamentoStatusMenuProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const { mutate, isPending, variables } = useAtualizarStatusAgendamento();

  const destinos = getTransicoesPermitidas(dsStatusOrigem);

  const handlePress = (destino: StatusDestino) => {
    mutate(
      { idAgendamento, dsStatus: destino, nrVersion },
      {
        onSuccess: () => {
          onClose();
        },
        // FM-04, achado nº 5 do brief: 409 é conflito de concorrência
        // otimista (outro processo já mudou o agendamento). A mutação já
        // invalida a query da agenda em onSettled (useAgenda.ts) tanto no
        // sucesso quanto no erro, então a lista se recarrega sozinha — o
        // Alert existe só para o usuário SABER que precisa olhar de novo,
        // em vez de a tela mudar sob os olhos dele em silêncio.
        onError: (err: unknown) => {
          const apiErr = err as ApiError;
          if (apiErr.status === 409) {
            Alert.alert(
              'Agendamento desatualizado',
              'Este agendamento foi alterado por outro processo enquanto você estava com a tela aberta. A lista foi recarregada — confira o status atual antes de tentar de novo.',
            );
          } else {
            Alert.alert(
              'Não foi possível atualizar',
              apiErr.message ?? 'Tente novamente em instantes.',
            );
          }
          onClose();
        },
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" testID="status-menu-modal-root">
      {visible && (
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.header}>
              <Text style={styles.headerTitle} testID="status-menu-pet-name">
                {nmPet}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                testID="btn-fechar-status-menu"
                style={{ padding: 4 }}
                accessibilityLabel="Fechar"
              >
                <KCIcon name="close" size={20} color={colors.textMute} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              {destinos.length === 0 ? (
                <Text style={styles.emptyText} testID="status-menu-empty">
                  Nenhuma ação disponível para este agendamento.
                </Text>
              ) : (
                destinos.map((destino) => (
                  <KCButton
                    key={destino}
                    variant={destino === 'CANCELADO' ? 'danger' : 'secondary'}
                    size="lg"
                    loading={isPending && variables?.dsStatus === destino}
                    disabled={isPending}
                    onPress={() => handlePress(destino)}
                    testID={`btn-status-${destino}`}
                  >
                    {DESTINO_LABEL[destino]}
                  </KCButton>
                ))
              )}
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}
