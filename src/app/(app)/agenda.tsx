import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { useAgendaSemana } from '@hooks/useAgenda';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCCard } from '@components/primitives/KCCard';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCEmptyState } from '@components/primitives/KCEmptyState';
import { AgendamentoStatusMenu } from '@components/domain/AgendamentoStatusMenu';
import { getTransicoesPermitidas } from '@services/agenda.service';
import { ROUTES } from '@constants/routes';
import {
  formatTime,
  formatWeekRange,
  getDayLabel,
  getDayNumber,
  getMondayOf,
  addDays,
  subDays,
  isSameDay,
  isToday,
} from '@utils/date';
import { STRINGS } from '@constants/strings';
import type { AgendamentoResponse } from '../../types/api';
import type { ChipTone } from '@components/primitives/KCChip';

function statusTone(sgStatus: AgendamentoResponse['sgStatus']): ChipTone {
  switch (sgStatus) {
    case 'AGENDADA':       return 'ocean';
    case 'CONFIRMADA':     return 'amber';
    case 'CONCLUIDA':      return 'sage';
    case 'CANCELADA':      return 'mute';
    // FM-04: bucket próprio (antes caía em 'CANCELADA', indistinguível de um
    // cancelamento de verdade — achado nº 2 do brief). 'clay' é o único tone
    // que sobra em KCChip (sage/amber/ocean/mute já usados acima) — reforça
    // que é um estado de atenção, diferente de cancelamento (mute).
    case 'NAO_COMPARECEU': return 'clay';
  }
}

function statusLabel(sgStatus: AgendamentoResponse['sgStatus']): string {
  switch (sgStatus) {
    case 'AGENDADA':       return 'Agendada';
    case 'CONFIRMADA':     return 'Confirmada';
    case 'CONCLUIDA':      return 'Concluída';
    case 'CANCELADA':      return 'Cancelada';
    case 'NAO_COMPARECEU': return 'Não compareceu';
  }
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    weekNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    navBtn: { padding: 4 },
    weekRange: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
    },
    dayTabsScroll: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      flexGrow: 0,
    },
    dayTabsContent: {
      paddingHorizontal: 8,
      paddingVertical: 8,
      gap: 4,
    },
    dayTab: {
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
      minWidth: 44,
      // CQ-08 fix wave 3 (achado I-1 da G2 rodada 2): `minWidth:44` sozinho
      // só provava o eixo largura — WCAG 2.5.5 exige 44×44, os DOIS eixos.
      // `paddingVertical:8` sobre texto pequeno não garante 44px de altura.
      minHeight: 44,
    },
    dayTabSelected: {
      backgroundColor: colors.primary,
    },
    dayLabel: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 11,
      color: colors.textMute,
    },
    dayLabelSelected: { color: colors.textOnPrimary },
    dayLabelToday: { color: colors.primary },
    dayNumber: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 16,
      color: colors.text,
      marginTop: 2,
    },
    dayNumberSelected: { color: colors.textOnPrimary },
    dayNumberToday: { color: colors.primary },
    todayDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
      marginTop: 3,
    },
    todayDotSelected: { backgroundColor: colors.textOnPrimary },
    list: { flex: 1 },
    listContent: {
      padding: 16,
      paddingBottom: 32,
    },
    skeletonRow: {
      height: 80,
      borderRadius: 20,
      marginBottom: 10,
      opacity: 0.45,
    },
    apptCard: { marginBottom: 10 },
    apptRow: { flexDirection: 'row', gap: 12 },
    timeBlock: {
      alignItems: 'center',
      width: 44,
      flexShrink: 0,
    },
    timeText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 14,
      color: colors.text,
    },
    durationText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 10,
      color: colors.textMute,
      marginTop: 2,
    },
    divider: {
      width: 1,
      backgroundColor: colors.border,
      marginHorizontal: 4,
    },
    apptContent: { flex: 1, gap: 4 },
    apptHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    petName: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    petDetail: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textSoft,
    },
    tutorText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
    },
    // FM-04: teleBtn e statusBtn (novo) agora moram lado a lado dentro de
    // actionsRow — o marginTop:8 saiu daqui e foi para o container, senão a
    // linha inteira duplicaria o respiro em vez de só o topo do bloco.
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    teleBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    teleBtnText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 11,
      color: colors.textOnPrimary,
    },
    // FM-04: botão "..." que abre o menu contextual de status (Ruling D-13 —
    // vive no card da agenda, não numa tela de "fechar atendimento" separada).
    // Estilo neutro (borda + surface), de propósito diferente do teleBtn
    // (primary, cor de destaque) — teleconsulta é a ação principal do card;
    // mudar status é secundária.
    statusBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    statusBtnText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 11,
      color: colors.text,
    },
  });

interface AgendaAppointmentCardProps {
  appointment: AgendamentoResponse;
  onAbrirStatusMenu: (appointment: AgendamentoResponse) => void;
}

function AgendaAppointmentCard({ appointment: a, onAbrirStatusMenu }: AgendaAppointmentCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();

  // FM-04 — Ruling D-13: o menu só oferece os destinos que a máquina de
  // estados permite a partir do status ATUAL (dsStatusOrigem cru, não
  // sgStatus traduzido — ver comentário em AgendamentoResponse, types/api.ts).
  // Um agendamento terminal (REALIZADO/CANCELADO/NAO_COMPARECEU) devolve []
  // aqui e o botão "..." nem aparece — é o teste "REALIZADO não oferece
  // ação nenhuma" do brief.
  const destinosDisponiveis = getTransicoesPermitidas(a.dsStatusOrigem);
  const temTeleconsulta = a.sgStatus !== 'CANCELADA';
  const temAcoesStatus = destinosDisponiveis.length > 0;

  return (
    <KCCard style={styles.apptCard} testID="agenda-appointment">
      <View style={styles.apptRow}>
        <View style={styles.timeBlock}>
          <Text style={styles.timeText}>{formatTime(a.dtInicio)}</Text>
          <Text style={styles.durationText}>{a.nrDuracaoMinutos}min</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.apptContent}>
          <View style={styles.apptHeader}>
            <Text style={styles.petName} numberOfLines={1}>{a.pet.nmPet}</Text>
            <KCChip tone={statusTone(a.sgStatus)}>{statusLabel(a.sgStatus)}</KCChip>
          </View>
          {/* Separador so aparece quando ha os DOIS lados. Sem esta guarda,
              um agendamento sem especie/raca renderiza um '·' orfao numa
              linha propria — medido na demo de 2026-08-20, tela Agenda, onde
              o contrato de agendamento nao carrega dados do pet. */}
          {[a.pet.nmEspecie, a.pet.nmRaca].filter(Boolean).length > 0 && (
            <Text style={styles.petDetail} numberOfLines={1}>
              {[a.pet.nmEspecie, a.pet.nmRaca].filter(Boolean).join(' · ')}
            </Text>
          )}
          <Text style={styles.tutorText} numberOfLines={1}>{a.tutor.nmTutor}</Text>
          {(temTeleconsulta || temAcoesStatus) && (
            <View style={styles.actionsRow}>
              {temTeleconsulta && (
                <TouchableOpacity
                  style={styles.teleBtn}
                  onPress={() => router.push(ROUTES.app.teleorientacao(a.pet.id, a.id))}
                  testID="btn-iniciar-teleconsulta"
                  accessibilityLabel="Iniciar teleconsulta"
                >
                  <KCIcon name="cam" size={12} color={colors.textOnPrimary} />
                  <Text style={styles.teleBtnText}>Teleconsulta</Text>
                </TouchableOpacity>
              )}
              {temAcoesStatus && (
                <TouchableOpacity
                  style={styles.statusBtn}
                  onPress={() => onAbrirStatusMenu(a)}
                  testID={`btn-status-menu-${a.id}`}
                  accessibilityLabel="Alterar status do agendamento"
                >
                  <KCIcon name="more" size={12} color={colors.text} />
                  <Text style={styles.statusBtnText}>Status</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </KCCard>
  );
}

export default function AgendaScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [semanaBase, setSemanaBase] = React.useState(() => new Date());
  const [selectedDay, setSelectedDay] = React.useState(() => new Date());
  // FM-04: um único menu no nível da tela (não um Modal por card) — evita
  // overlays empilhados e mantém o estado de "qual agendamento está com o
  // menu aberto" num só lugar.
  const [statusMenuAppointment, setStatusMenuAppointment] =
    React.useState<AgendamentoResponse | null>(null);

  const { data, isLoading, semanaStart, semanaEnd, refetch } = useAgendaSemana(semanaBase);

  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(semanaStart, i)),
    [semanaStart],
  );

  const appointmentsForDay = React.useMemo(() => {
    if (!data) return [];
    return data
      .filter((a) => isSameDay(new Date(a.dtInicio), selectedDay))
      .sort((a, b) => new Date(a.dtInicio).getTime() - new Date(b.dtInicio).getTime());
  }, [data, selectedDay]);

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const goToPrevWeek = () => {
    const prev = subDays(semanaBase, 7);
    setSemanaBase(prev);
    setSelectedDay(getMondayOf(prev));
  };

  const goToNextWeek = () => {
    const next = addDays(semanaBase, 7);
    setSemanaBase(next);
    setSelectedDay(getMondayOf(next));
  };

  return (
    // CQ-15: `paddingHorizontal={0}` — agenda já controla seu próprio respiro
    // horizontal por região (weekNav, dayTabsContent, listContent), cada uma
    // com um valor diferente; deixar o ScreenContainer aplicar o padding
    // responsivo dele por cima somaria aos paddings locais em vez de
    // substituí-los. O ganho aqui é `maxContentWidth` + centralização +
    // SafeAreaView compartilhada, não o padding.
    // CQ-15 fix wave (G2 Important #2, por consistência): `style={{paddingBottom:0}}`
    // cancela o `paddingBottom:24` do modo flat, que encolheria o filho flex
    // (o `ScrollView` da lista) em 24px. Sem efeito visível aqui (mesma cor
    // de fundo), mas aplicado pela mesma razão que em `teleorientacao`, para
    // não deixar a tela dependente de o fundo ser opaco pra mascarar o corte.
    // G2 Minor #5, não corrigido: a tela usava `edges={['top']}` explícito
    // antes da migração; o ScreenContainer aplica todas as bordas por
    // padrão, então em landscape/notch lateral os insets left/right passam
    // a encolher a `weekNav` (full-bleed). Provavelmente inofensivo — a
    // primitiva agora tem a prop `edges` (ver ScreenContainer.tsx) pra
    // restaurar isso caso vire regressão visível de verdade.
    <ScreenContainer scroll={false} paddingHorizontal={0} style={{ paddingBottom: 0 }}>
      <View style={styles.weekNav}>
        <TouchableOpacity
          onPress={goToPrevWeek}
          testID="btn-prev-week"
          style={styles.navBtn}
          accessibilityLabel={STRINGS.agenda.semanaAnterior}
        >
          <KCIcon name="back" size={20} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.weekRange} testID="week-range">
          {formatWeekRange(semanaStart, semanaEnd)}
        </Text>
        <TouchableOpacity
          onPress={goToNextWeek}
          testID="btn-next-week"
          style={styles.navBtn}
          accessibilityLabel={STRINGS.agenda.proximaSemana}
        >
          <KCIcon name="arrowR" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dayTabsScroll}
        contentContainerStyle={styles.dayTabsContent}
      >
        {weekDays.map((day, i) => {
          const selected = isSameDay(day, selectedDay);
          const today = isToday(day);
          return (
            <TouchableOpacity
              key={i}
              onPress={() => setSelectedDay(day)}
              testID={`day-tab-${i}`}
              style={[styles.dayTab, selected && styles.dayTabSelected]}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.dayLabel,
                  selected && styles.dayLabelSelected,
                  today && !selected && styles.dayLabelToday,
                ]}
              >
                {getDayLabel(day)}
              </Text>
              <Text
                style={[
                  styles.dayNumber,
                  selected && styles.dayNumberSelected,
                  today && !selected && styles.dayNumberToday,
                ]}
              >
                {getDayNumber(day)}
              </Text>
              {today && (
                <View style={[styles.todayDot, selected && styles.todayDotSelected]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {isLoading ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                testID="skeleton"
                style={[styles.skeletonRow, { backgroundColor: colors.border }]}
              />
            ))}
          </>
        ) : appointmentsForDay.length === 0 ? (
          <KCEmptyState
            icon="agenda"
            title={STRINGS.agenda.semConsultas}
            description={STRINGS.agenda.semConsultasDesc}
            testID="empty-agenda"
          />
        ) : (
          appointmentsForDay.map((a) => (
            <AgendaAppointmentCard
              key={a.id}
              appointment={a}
              onAbrirStatusMenu={setStatusMenuAppointment}
            />
          ))
        )}
      </ScrollView>

      <AgendamentoStatusMenu
        visible={statusMenuAppointment !== null}
        onClose={() => setStatusMenuAppointment(null)}
        idAgendamento={statusMenuAppointment?.id ?? 0}
        nrVersion={statusMenuAppointment?.nrVersion ?? 0}
        dsStatusOrigem={statusMenuAppointment?.dsStatusOrigem ?? ''}
        nmPet={statusMenuAppointment?.pet.nmPet ?? ''}
      />
    </ScreenContainer>
  );
}
