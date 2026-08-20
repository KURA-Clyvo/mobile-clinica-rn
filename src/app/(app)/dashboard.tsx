import React from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors, type BreakpointKey } from '@theme/tokens';
import { useAuthStore } from '@store/authStore';
import { useBreakpoint } from '@hooks/useBreakpoint';
import { useDashboardHoje, useAlertas, useRecentes } from '@hooks/useDashboard';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { MetricCard } from '@components/domain/MetricCard';
import { AlertCard } from '@components/domain/AlertCard';
import { KCCard } from '@components/primitives/KCCard';
import { KCChip } from '@components/primitives/KCChip';
import { formatDateFull, formatTime, getGreeting, firstName } from '@utils/date';
import { STRINGS } from '@constants/strings';
import type { RecentAppointmentResponse, AlertaResponse } from '../../types/api';
import type { ChipTone } from '@components/primitives/KCChip';
import type { KCIconName } from '@components/primitives/KCIcon';
import type { MetricTone } from '@components/domain/MetricCard';

// Agrupa uma lista em sub-listas ("linhas") de até `size` itens, mantendo a
// ordem — usado tanto para o grid de métricas quanto para as listas de
// atendimentos/alertas. `size <= 1` devolve uma linha por item (mesmo
// resultado do empilhamento de coluna única de antes da CQ-06).
function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 1) return items.map((item) => [item]);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

// CQ-06 — decisão de desenho: a contagem de colunas é resolvida em JS a
// partir do breakpoint (`useBreakpoint().isAtLeast`), e a árvore renderizada
// (quantos `MetricCard`/linhas existem) muda de fato entre viewports — não
// é CSS puro (`flexWrap`/`%`). Motivo: o `react-test-renderer` deste projeto
// não computa layout Yoga (`onLayout` nunca dispara, `toJSON()` só ecoa o
// estilo declarado), então só uma árvore que muda de verdade prova o
// comportamento na suíte automatizada. Ver task-CQ-06-report.md.
function metricsColumnsFor(isAtLeast: (key: BreakpointKey) => boolean): 1 | 2 | 4 {
  if (isAtLeast('xl')) return 4;
  if (isAtLeast('md')) return 2;
  return 1;
}

// Listas de "próximos atendimentos" e "alertas" ganham 2 colunas a partir de
// `lg` (1024) — critério explícito do brief ("≥ lg").
function listColumnsFor(isAtLeast: (key: BreakpointKey) => boolean): 1 | 2 {
  return isAtLeast('lg') ? 2 : 1;
}

interface MetricItem {
  key: string;
  label: string;
  value: number;
  icon: KCIconName;
  tone: MetricTone;
}

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
      flex: 1,
      height: 72,
      borderRadius: 20,
      opacity: 0.45,
    },
    listGrid: { gap: 10 },
    listRow: { flexDirection: 'row', gap: 10 },
    listRowItem: { flex: 1 },
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
    appointmentCard: { flex: 1 },
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
  const { isAtLeast } = useBreakpoint();

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

  const metricsColumns = metricsColumnsFor(isAtLeast);
  const listColumns = listColumnsFor(isAtLeast);

  const metricItems: MetricItem[] = [
    {
      key: 'consultasHoje',
      label: STRINGS.dashboard.consultasHoje,
      value: metrics?.nrConsultasHoje ?? 0,
      icon: 'consult',
      tone: 'ocean',
    },
    {
      key: 'pacientesAtendidos',
      label: STRINGS.dashboard.pacientesAtendidos,
      value: metrics?.nrPacientesAtendidos ?? 0,
      icon: 'patients',
      tone: 'sage',
    },
    {
      key: 'alertasAtivos',
      label: STRINGS.dashboard.alertasAtivos,
      value: metrics?.nrAlertasAtivos ?? 0,
      icon: 'alert',
      tone: 'clay',
    },
    {
      key: 'teleorientacoes',
      label: STRINGS.dashboard.teleorientacoes,
      value: metrics?.nrTeleorientacoes ?? 0,
      icon: 'tele',
      tone: 'amber',
    },
  ];

  // 4 placeholders — mesma contagem do grid real, agrupados pelo mesmo
  // `metricsColumns`, para que o skeleton nunca "salte" de forma ao virar
  // conteúdo (critério de aceite explícito da task).
  const skeletonMetricRows = chunk([0, 1, 2, 3] as const, metricsColumns);

  const appointmentRows = chunk(recentes ?? [], listColumns);
  const alertRows = chunk(alertas ?? [], listColumns);
  const skeletonAppointmentRows = chunk([0, 1, 2] as const, listColumns);
  const skeletonAlertRows = chunk([0, 1] as const, listColumns);

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
          {skeletonMetricRows.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.metricsRow} testID="metrics-skeleton-row">
              {row.map((cardIndex) => (
                <View
                  key={cardIndex}
                  testID="skeleton"
                  style={[styles.skeletonCard, { backgroundColor: colors.border }]}
                />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.metricsGrid} testID="metrics-grid">
          {chunk(metricItems, metricsColumns).map((row, rowIndex) => (
            <View key={rowIndex} style={styles.metricsRow} testID="metrics-row">
              {row.map((item) => (
                <MetricCard
                  key={item.key}
                  label={item.label}
                  value={item.value}
                  icon={item.icon}
                  tone={item.tone}
                />
              ))}
            </View>
          ))}
        </View>
      )}

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>{STRINGS.dashboard.proximosAtendimentos}</Text>
        {loadingRecentes ? (
          <View style={styles.listGrid}>
            {skeletonAppointmentRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.listRow} testID="appointments-skeleton-row">
                {row.map((i) => (
                  <View
                    key={i}
                    testID="skeleton"
                    style={[styles.listRowItem, styles.skeletonRow, { backgroundColor: colors.border }]}
                  />
                ))}
              </View>
            ))}
          </View>
        ) : recentes == null || recentes.length === 0 ? (
          <Text style={styles.emptyText} testID="empty-appointments">
            {STRINGS.dashboard.semAtendimentos}
          </Text>
        ) : (
          <View style={styles.listGrid}>
            {appointmentRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.listRow} testID="appointments-row">
                {row.map((item) => (
                  <View key={item.id} style={styles.listRowItem} testID="appointments-item">
                    <AppointmentRow item={item} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.sectionBlock}>
        <Text style={styles.sectionTitle}>{STRINGS.dashboard.alertas}</Text>
        {loadingAlertas ? (
          <View style={styles.listGrid}>
            {skeletonAlertRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.listRow} testID="alerts-skeleton-row">
                {row.map((i) => (
                  <View
                    key={i}
                    testID="skeleton"
                    style={[styles.listRowItem, styles.skeletonRow, { backgroundColor: colors.border }]}
                  />
                ))}
              </View>
            ))}
          </View>
        ) : alertas == null || alertas.length === 0 ? (
          <Text style={styles.emptyText} testID="empty-alerts">
            {STRINGS.dashboard.semAlertas}
          </Text>
        ) : (
          <View style={styles.listGrid}>
            {alertRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.listRow} testID="alerts-row">
                {row.map((alerta: AlertaResponse) => (
                  <View key={alerta.id} style={styles.listRowItem} testID="alerts-item">
                    <AlertCard alerta={alerta} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
