import React from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { useAuthStore } from '@store/authStore';
import { useDashboardHoje, useAlertas, useRecentes } from '@hooks/useDashboard';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { MetricCard } from '@components/domain/MetricCard';
import { AlertCard } from '@components/domain/AlertCard';
import { KCCard } from '@components/primitives/KCCard';
import { KCChip } from '@components/primitives/KCChip';
import { formatDateFull, formatTime, getGreeting, firstName } from '@utils/date';
import { STRINGS } from '@constants/strings';
import type { RecentAppointmentResponse } from '../../types/api';
import type { ChipTone } from '@components/primitives/KCChip';

function statusTone(sgStatus: RecentAppointmentResponse['sgStatus']): ChipTone {
  switch (sgStatus) {
    case 'AGENDADA':     return 'ocean';
    case 'EM_ANDAMENTO': return 'amber';
    case 'CONCLUIDA':    return 'sage';
    case 'CANCELADA':    return 'mute';
  }
}

function statusLabel(sgStatus: RecentAppointmentResponse['sgStatus']): string {
  switch (sgStatus) {
    case 'AGENDADA':     return 'Agendada';
    case 'EM_ANDAMENTO': return 'Em andamento';
    case 'CONCLUIDA':    return 'Concluída';
    case 'CANCELADA':    return 'Cancelada';
  }
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    greeting: {
      marginTop: 16,
      marginBottom: 20,
    },
    greetingText: {
      fontFamily: 'Cormorant_500Medium',
      fontSize: 26,
      color: colors.text,
    },
    dateText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      marginTop: 2,
      textTransform: 'capitalize',
    },
    metricsGrid: { gap: 10, marginBottom: 24 },
    metricsRow: { flexDirection: 'row', gap: 10 },
    skeletonCard: {
      flex: 1,
      height: 100,
      borderRadius: 20,
      opacity: 0.45,
    },
    skeletonRow: {
      height: 72,
      borderRadius: 20,
      marginBottom: 8,
      opacity: 0.45,
    },
    sectionTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
      marginBottom: 10,
    },
    sectionBlock: { marginBottom: 24 },
    emptyText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.textMute,
      textAlign: 'center',
      paddingVertical: 20,
    },
    appointmentCard: { marginBottom: 8 },
    appointmentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    appointmentLeft: { flex: 1 },
    appointmentPet: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 14,
      color: colors.text,
    },
    appointmentSub: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      marginTop: 2,
    },
    appointmentRight: { alignItems: 'flex-end', gap: 4 },
    appointmentTime: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textSoft,
    },
  });

interface AppointmentRowProps {
  item: RecentAppointmentResponse;
}

function AppointmentRow({ item }: AppointmentRowProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <KCCard style={styles.appointmentCard} testID="appointment-row">
      <View style={styles.appointmentRow}>
        <View style={styles.appointmentLeft}>
          <Text style={styles.appointmentPet} numberOfLines={1}>
            {item.nmPet}
          </Text>
          <Text style={styles.appointmentSub} numberOfLines={1}>
            {item.nmTutor} · {item.nmTipoConsulta}
          </Text>
        </View>
        <View style={styles.appointmentRight}>
          <Text style={styles.appointmentTime}>{formatTime(item.dtAgendamento)}</Text>
          <KCChip tone={statusTone(item.sgStatus)} dot>
            {statusLabel(item.sgStatus)}
          </KCChip>
        </View>
      </View>
    </KCCard>
  );
}

export default function DashboardScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const usuario = useAuthStore((s) => s.usuario);

  const { data: hoje, isLoading: loadingHoje, refetch: refetchHoje } = useDashboardHoje();
  const { data: alertas, isLoading: loadingAlertas, refetch: refetchAlertas } = useAlertas();
  const { data: recentes, isLoading: loadingRecentes, refetch: refetchRecentes } = useRecentes();

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchHoje(), refetchAlertas(), refetchRecentes()]);
    setRefreshing(false);
  }, [refetchHoje, refetchAlertas, refetchRecentes]);

  const metrics = hoje?.metrics;
  const name = usuario ? firstName(usuario.nmVeterinario) : '';

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.greeting} testID="greeting-block">
        <Text style={styles.greetingText}>
          {getGreeting()}{name ? `, ${name}` : ''}
        </Text>
        <Text style={styles.dateText}>{formatDateFull(new Date())}</Text>
      </View>

      {loadingHoje ? (
        <View style={styles.metricsGrid} testID="metrics-skeleton">
          <View style={styles.metricsRow}>
            <View testID="skeleton" style={[styles.skeletonCard, { backgroundColor: colors.border }]} />
            <View testID="skeleton" style={[styles.skeletonCard, { backgroundColor: colors.border }]} />
          </View>
          <View style={styles.metricsRow}>
            <View testID="skeleton" style={[styles.skeletonCard, { backgroundColor: colors.border }]} />
            <View testID="skeleton" style={[styles.skeletonCard, { backgroundColor: colors.border }]} />
          </View>
        </View>
      ) : (
        <View style={styles.metricsGrid} testID="metrics-grid">
          <View style={styles.metricsRow}>
            <MetricCard
              label={STRINGS.dashboard.consultasHoje}
              value={metrics?.nrConsultasHoje ?? 0}
              icon="consult"
              tone="ocean"
            />
            <MetricCard
              label={STRINGS.dashboard.pacientesAtendidos}
              value={metrics?.nrPacientesAtendidos ?? 0}
              icon="patients"
              tone="sage"
            />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard
              label={STRINGS.dashboard.alertasAtivos}
              value={metrics?.nrAlertasAtivos ?? 0}
              icon="alert"
              tone="clay"
            />
            <MetricCard
              label={STRINGS.dashboard.teleorientacoes}
              value={metrics?.nrTeleorientacoes ?? 0}
              icon="tele"
              tone="amber"
            />
          </View>
        </View>
      )}

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>{STRINGS.dashboard.proximosAtendimentos}</Text>
        {loadingRecentes ? (
          <>
            {[0, 1, 2].map((i) => (
              <View key={i} testID="skeleton" style={[styles.skeletonRow, { backgroundColor: colors.border }]} />
            ))}
          </>
        ) : recentes == null || recentes.length === 0 ? (
          <Text style={styles.emptyText} testID="empty-appointments">
            {STRINGS.dashboard.semAtendimentos}
          </Text>
        ) : (
          recentes.map((item) => <AppointmentRow key={item.id} item={item} />)
        )}
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>{STRINGS.dashboard.alertas}</Text>
        {loadingAlertas ? (
          <>
            {[0, 1].map((i) => (
              <View key={i} testID="skeleton" style={[styles.skeletonRow, { backgroundColor: colors.border }]} />
            ))}
          </>
        ) : alertas == null || alertas.length === 0 ? (
          <Text style={styles.emptyText} testID="empty-alerts">
            {STRINGS.dashboard.semAlertas}
          </Text>
        ) : (
          alertas.map((alerta) => <AlertCard key={alerta.id} alerta={alerta} />)
        )}
      </View>
    </ScreenContainer>
  );
}
