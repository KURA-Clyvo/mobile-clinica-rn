import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { useAgendaSemana } from '@hooks/useAgenda';
import { KCCard } from '@components/primitives/KCCard';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
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
    case 'AGENDADA':     return 'ocean';
    case 'EM_ANDAMENTO': return 'amber';
    case 'CONCLUIDA':    return 'sage';
    case 'CANCELADA':    return 'mute';
  }
}

function statusLabel(sgStatus: AgendamentoResponse['sgStatus']): string {
  switch (sgStatus) {
    case 'AGENDADA':     return 'Agendada';
    case 'EM_ANDAMENTO': return 'Em andamento';
    case 'CONCLUIDA':    return 'Concluída';
    case 'CANCELADA':    return 'Cancelada';
  }
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
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
    emptyContainer: {
      alignItems: 'center',
      paddingTop: 64,
    },
    emptyText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 14,
      color: colors.textMute,
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
  });

interface AgendaAppointmentCardProps {
  appointment: AgendamentoResponse;
}

function AgendaAppointmentCard({ appointment: a }: AgendaAppointmentCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

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
          <Text style={styles.petDetail} numberOfLines={1}>
            {a.pet.nmEspecie} · {a.pet.nmRaca}
          </Text>
          <Text style={styles.tutorText} numberOfLines={1}>{a.tutor.nmTutor}</Text>
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
    <SafeAreaView style={styles.safe} edges={['top']}>
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
          <View style={styles.emptyContainer} testID="empty-agenda">
            <Text style={styles.emptyText}>{STRINGS.agenda.semConsultas}</Text>
          </View>
        ) : (
          appointmentsForDay.map((a) => (
            <AgendaAppointmentCard key={a.id} appointment={a} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
