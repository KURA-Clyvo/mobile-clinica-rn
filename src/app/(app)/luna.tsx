import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '@theme/index';
import { lightColors, spacing } from '@theme/tokens';
import { useLunaHealth, useRelatorioTriagens } from '@hooks/useLuna';
import { useAlertas } from '@hooks/useDashboard';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCCard } from '@components/primitives/KCCard';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
import { AlertCard } from '@components/domain/AlertCard';
import { formatDateISO, subDays } from '@utils/date';
import { STRINGS } from '@constants/strings';
import type { LunaHealthResponse } from '../../types/api';
import type { KCIconName } from '@components/primitives/KCIcon';

type Periodo = 7 | 30 | 90;
type UrgLevel = 'BAIXO' | 'MEDIO' | 'ALTO' | 'CRITICO';

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 7, label: STRINGS.LUNA.PERIODO_7 },
  { value: 30, label: STRINGS.LUNA.PERIODO_30 },
  { value: 90, label: STRINGS.LUNA.PERIODO_90 },
];

const SERVICO_META: Record<
  keyof LunaHealthResponse['servicos'],
  { label: string; icon: KCIconName }
> = {
  twilio: { label: 'Twilio', icon: 'share' },
  oracle: { label: 'Oracle DB', icon: 'more' },
  visaoComputacional: { label: 'Visão', icon: 'cam' },
};

const URG_LEVELS: UrgLevel[] = ['BAIXO', 'MEDIO', 'ALTO', 'CRITICO'];

// getLunaHealth() nunca rejeita: quando a Luna está fora do ar ela resolve com
// {status: 'indisponivel'} em vez de lançar. Este type guard estreita a união antes de
// acessar sgStatus/servicos — sem ele o acesso direto é um crash real em runtime.
function isLunaHealthUp(
  health: LunaHealthResponse | { status: 'indisponivel' } | undefined,
): health is LunaHealthResponse {
  return health != null && 'sgStatus' in health;
}

function urgColor(level: UrgLevel, colors: typeof lightColors): string {
  switch (level) {
    case 'BAIXO':   return colors.success;
    case 'MEDIO':   return colors.warning;
    case 'ALTO':    return colors.amber;
    case 'CRITICO': return colors.danger;
  }
}

function urgLabel(level: UrgLevel): string {
  switch (level) {
    case 'BAIXO':   return 'Baixo';
    case 'MEDIO':   return 'Médio';
    case 'ALTO':    return 'Alto';
    case 'CRITICO': return 'Crítico';
  }
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    section: { paddingHorizontal: 16, marginTop: 12 },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    lunaTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
    },
    lunaSubtitle: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      marginTop: 2,
    },
    statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    statusText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 12,
    },
    subServicesRow: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 8,
    },
    subCard: { flex: 1, padding: 10 },
    subLabel: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 11,
      color: colors.textMute,
      marginTop: 4,
    },
    subStatus: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 11,
      marginTop: 2,
    },
    // CQ-07: sem flexWrap, o título e os 3 chips de período disputavam a
    // mesma linha e se comprimiam em telas estreitas (Bloco 0 §2, B0.5).
    // flexWrap:'wrap' deixa o grupo de chips descer para uma segunda linha
    // quando não cabe — em telas ≥ md normalmente sobra largura e o layout
    // permanece lado a lado sem precisar de lógica de breakpoint em JS.
    reportHeader: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing[4],
      marginTop: spacing[4],
      marginBottom: spacing[2],
      rowGap: spacing[2],
    },
    reportTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
      // Permite ao título ceder espaço para o grupo de chips em vez de
      // empurrá-lo pra fora da tela — parceiro do flexWrap acima.
      flexShrink: 1,
    },
    // gap: 6 não existe na escala de `spacing` e pressionava a exceção de
    // espaçamento da WCAG 2.5.8 (SC 2.5.8 permite alvo abaixo de 24×24 se
    // houver espaçamento suficiente entre alvos vizinhos). Com o chip
    // interativo agora em 44×44 (ver KCChip.tsx), o alvo em si já atende o
    // critério — o gap maior aqui é para respiro visual, não para cumprir a
    // exceção.
    periodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
    reportCard: { marginHorizontal: 16 },
    totalText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 14,
      color: colors.text,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 10,
    },
    urgRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 6,
    },
    urgLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    urgDot: { width: 8, height: 8, borderRadius: 4 },
    urgLabelText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 14,
      color: colors.text,
    },
    urgCountText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 14,
      color: colors.text,
    },
    progressBg: {
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      marginTop: 2,
      marginBottom: 4,
    },
    encText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.textSoft,
      marginTop: 8,
    },
    skeletonRow: {
      height: 36,
      borderRadius: 8,
      marginBottom: 6,
      opacity: 0.45,
    },
    alertasSection: { paddingHorizontal: 16, marginTop: 16, marginBottom: 24 },
    alertasTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
      marginBottom: 10,
    },
    emptyText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.textMute,
      textAlign: 'center',
      paddingVertical: 20,
    },
  });

export default function LunaScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<Periodo>(7);
  const [refreshing, setRefreshing] = useState(false);

  const dataFim = formatDateISO(new Date());
  const dataInicio = formatDateISO(subDays(new Date(), periodo));

  const { data: health } = useLunaHealth();
  const { data: relatorio, isLoading: loadingRelatorio } = useRelatorioTriagens({
    dataInicio,
    dataFim,
  });
  const { data: alertas } = useAlertas();

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['luna'] });
    setRefreshing(false);
  };

  // Luna fora do ar (indisponível) cai no mesmo ramo visual de "DOWN": vermelho + Offline.
  // Nunca acessa sgStatus/servicos sem antes confirmar que a união é LunaHealthResponse.
  const healthUp = isLunaHealthUp(health);

  const statusColor = !healthUp
    ? colors.danger
    : health.sgStatus === 'UP'
      ? colors.success
      : health.sgStatus === 'DEGRADED'
        ? colors.warning
        : colors.danger;

  const statusLabel = !healthUp
    ? STRINGS.LUNA.STATUS_OFFLINE
    : health.sgStatus === 'UP'
      ? STRINGS.LUNA.STATUS_ONLINE
      : health.sgStatus === 'DEGRADED'
        ? STRINGS.LUNA.STATUS_DEGRADADO
        : STRINGS.LUNA.STATUS_OFFLINE;

  const total = relatorio?.nrTotalTriagens ?? 0;

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
      {/* STATUS */}
      <View style={styles.section}>
        <KCCard>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.lunaTitle}>Luna</Text>
              <Text style={styles.lunaSubtitle}>Assistente inteligente KURA</Text>
            </View>
            <View style={styles.statusIndicator}>
              <View
                style={[styles.dot, { backgroundColor: statusColor }]}
                testID="status-dot"
              />
              <Text
                style={[styles.statusText, { color: statusColor }]}
                testID="status-text"
              >
                {statusLabel}
              </Text>
            </View>
          </View>
        </KCCard>
      </View>

      {/* SUB-SERVIÇOS */}
      {healthUp && (
        <View style={styles.subServicesRow} testID="sub-services">
          {(Object.keys(SERVICO_META) as (keyof typeof SERVICO_META)[]).map((key) => {
            const isUp = health.servicos[key] === 'UP';
            const meta = SERVICO_META[key];
            const svcColor = isUp ? colors.success : colors.danger;
            return (
              <KCCard key={key} style={styles.subCard}>
                <KCIcon name={meta.icon} size={20} color={svcColor} />
                <Text style={styles.subLabel}>{meta.label}</Text>
                <Text style={[styles.subStatus, { color: svcColor }]} testID={`svc-${key}`}>
                  {isUp ? 'UP' : 'DOWN'}
                </Text>
              </KCCard>
            );
          })}
        </View>
      )}

      {/* RELATÓRIO DE TRIAGENS */}
      <View style={styles.reportHeader} testID="report-header">
        <Text style={styles.reportTitle}>{STRINGS.LUNA.RELATORIO_TITLE}</Text>
        <View style={styles.periodRow} testID="period-row">
          {PERIODOS.map(({ value, label }) => (
            <KCChip
              key={value}
              tone={periodo === value ? 'ocean' : 'mute'}
              onPress={() => setPeriodo(value)}
              testID={`chip-periodo-${value}`}
            >
              {label}
            </KCChip>
          ))}
        </View>
      </View>

      <KCCard style={styles.reportCard}>
        {loadingRelatorio ? (
          <>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                testID="skeleton"
                style={[styles.skeletonRow, { backgroundColor: colors.border }]}
              />
            ))}
          </>
        ) : (
          <>
            <Text style={styles.totalText} testID="total-triagens">
              {STRINGS.LUNA.TOTAL_TRIAGENS(total)}
            </Text>
            <View style={styles.separator} />
            {URG_LEVELS.map((level) => {
              const count = relatorio?.distribuicaoUrgencia[level] ?? 0;
              const pct = total > 0 ? Math.min((count / total) * 100, 100) : 0;
              const col = urgColor(level, colors);
              return (
                <View key={level} testID={`urg-row-${level}`}>
                  <View style={styles.urgRow}>
                    <View style={styles.urgLeft}>
                      <View style={[styles.urgDot, { backgroundColor: col }]} />
                      <Text style={styles.urgLabelText}>{urgLabel(level)}</Text>
                    </View>
                    <Text style={styles.urgCountText}>{count}</Text>
                  </View>
                  <View style={styles.progressBg}>
                    <View
                      style={{
                        height: 4,
                        width: `${pct}%`,
                        backgroundColor: col,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                </View>
              );
            })}
            {relatorio && (
              <Text style={styles.encText} testID="encaminhadas">
                {STRINGS.LUNA.ENCAMINHADAS(relatorio.nrEncaminhadasParaVet)}
              </Text>
            )}
          </>
        )}
      </KCCard>

      {/* ALERTAS */}
      <View style={styles.alertasSection}>
        <Text style={styles.alertasTitle}>{STRINGS.LUNA.ALERTAS_TITLE}</Text>
        {alertas == null || alertas.length === 0 ? (
          <Text style={styles.emptyText} testID="empty-alertas">
            {STRINGS.LUNA.EMPTY_ALERTAS}
          </Text>
        ) : (
          alertas.map((alerta) => <AlertCard key={alerta.id} alerta={alerta} />)
        )}
      </View>
    </ScreenContainer>
  );
}
