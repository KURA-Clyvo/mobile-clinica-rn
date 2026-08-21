import React from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
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
// atendimentos/alertas. `size <= 1` devolve uma linha por item. Não é o
// mesmo shape estrutural do empilhamento de antes da CQ-06 (que era
// `.map()` plano, sem `View` de linha nem `listRowItem`, com `marginBottom`
// em vez do `gap: 10` do `listGrid`) — só o resultado visual (1 item por
// linha) é equivalente.
function chunk<T>(items: readonly T[], size: number): T[][] {
  if (size <= 1) return items.map((item) => [item]);
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

// `formatDateFull` já devolve a string correta em pt-BR, inteiramente
// minúscula ("20 de agosto de 2026, quinta-feira") — quem capitalizava
// errado era o CSS `textTransform: 'capitalize'` do `dateText` (removido),
// que maiúsculiza TODA palavra, inclusive preposições ("De Agosto De...").
// Regra pt-BR correta: só a primeira letra da frase. Função local — a
// própria `formatDateFull` (compartilhada com `consulta/[idPet].tsx` e
// `receituario/[idPet].tsx`, nenhum dos quais aplica `capitalize`) não
// precisa mudar.
function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// CQ-06 G2 fix wave, achado B — quando a última linha de um `chunk()` fica
// incompleta (contagem de itens não é múltipla de `columns`), o(s) filho(s)
// que sobram têm `flex: 1` dentro de uma `View` `flexDirection: 'row'`
// sozinhos na linha, e por semântica de Yoga/flexbox um único filho com
// `flex: 1` ocupa 100% da largura da linha — não a mesma largura que um
// item teria numa linha completa. Preenche a linha com espaçadores
// invisíveis do mesmo `flex: 1` até `columns`, para que TODO item (inclusive
// o de uma linha final com resto, inclusive uma lista de 1 item só) sempre
// divida a largura da linha da mesma forma. O espaçador não recebe
// `testID` — não deve aparecer nas queries `*-item` existentes; só conta
// como filho a mais na árvore, o que é a prova estrutural do fix (o
// `react-test-renderer` não computa largura em px, só a forma da árvore).
function rowSpacers(itemCount: number, columns: number, style: StyleProp<ViewStyle>): React.ReactNode {
  const missing = columns - itemCount;
  if (missing <= 0) return null;
  return Array.from({ length: missing }, (_, i) => <View key={`spacer-${i}`} style={style} />);
}

// CQ-06 — decisão de desenho: a contagem de colunas é resolvida em JS a
// partir do breakpoint (`useBreakpoint().isAtLeast`), e a árvore renderizada
// (quantos `MetricCard`/linhas existem) muda de fato entre viewports — não
// é CSS puro (`flexWrap`/`%`). Motivo: o `react-test-renderer` deste projeto
// não computa layout Yoga (`onLayout` nunca dispara, `toJSON()` só ecoa o
// estilo declarado), então só uma árvore que muda de verdade prova o
// comportamento na suíte automatizada. Ver task-CQ-06-report.md.
//
// Corte `sm→1, md→2, lg→4, xl→4` — revisado na G2 fix wave (achado A). O
// corte original tinha `lg→2`, e a G2 mediu que a partir de ~1200px de
// viewport o `ScreenContainer` já satura `maxContentWidth` (1200px), então
// a largura ÚTIL da linha de métricas para de crescer e fica congelada em
// ~1136px — ou seja, em 1439px e 1440px o espaço disponível é literalmente
// idêntico, mas o corte antigo desenhava 2 cards de ~563px num e 4 de
// ~276px no outro: descontinuidade sem ganho de espaço nenhum por trás
// dela. E no ponto mais estreito de `lg` (1024px), 4 colunas já dão ~232px
// por card contra os ~276px que `xl` entrega — 16% de diferença, não
// "espremido". A faixa 1024–1439 cobre 1280 e 1366, as larguras de
// notebook mais comuns — hoje recebem a mesma contagem de colunas que um
// monitor de desktop.
function metricsColumnsFor(isAtLeast: (key: BreakpointKey) => boolean): 1 | 2 | 4 {
  if (isAtLeast('lg')) return 4;
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
    // CQ-06 G2 fix wave, achado H — `AppointmentRow` ganha altura igual entre
    // os cards de uma mesma linha via `appointmentCard: { flex: 1 }` acima;
    // `AlertCard` não tinha equivalente (achado H.2). `flex: 1` iguala a
    // altura; `marginBottom: 0` neutraliza o `marginBottom: 8` do estilo
    // base do `AlertCard` (achado H.1), redundante aqui com o `gap: 10` do
    // `listGrid` — `luna.tsx`, que não passa esse override, mantém o
    // `marginBottom: 8` original sem mudança de comportamento.
    alertCardInGrid: { flex: 1, marginBottom: 0 },
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
  // CQ-06 G2 fix wave, RODADA 2 (I-2): eram 2 placeholders (`[0, 1]`). Com
  // `listColumns` só assumindo 1 ou 2, 2 itens dividem SEMPRE exato
  // (2÷1=2 linhas de 1, 2÷2=1 linha de 2) — `missing` em `rowSpacers()`
  // nunca passava de 0 ali, então a chamada daquele call site era
  // matematicamente inerte e nenhum teste conseguiria provar sua remoção.
  // 3 placeholders (igual ao de atendimentos) faz `lg`/`xl` produzirem uma
  // linha incompleta de verdade, tornando o call site observável. Não
  // muda dado real — só a contagem de barras cinzas durante o loading.
  const skeletonAlertRows = chunk([0, 1, 2] as const, listColumns);

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
        <Text style={styles.dateText}>{capitalizeFirst(formatDateFull(new Date()))}</Text>
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
                {rowSpacers(row.length, listColumns, styles.listRowItem)}
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
                {rowSpacers(row.length, listColumns, styles.listRowItem)}
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
                {rowSpacers(row.length, listColumns, styles.listRowItem)}
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
                    <AlertCard alerta={alerta} style={styles.alertCardInGrid} />
                  </View>
                ))}
                {rowSpacers(row.length, listColumns, styles.listRowItem)}
              </View>
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
