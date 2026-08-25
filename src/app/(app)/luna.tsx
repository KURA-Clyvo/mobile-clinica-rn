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
import { formatDateISO, subDays, addDays } from '@utils/date';
import { STRINGS } from '@constants/strings';
import type { LunaHealthResult } from '@services/luna.service';
import type { KCIconName } from '@components/primitives/KCIcon';

type Periodo = 7 | 30 | 90;
// CQ-09: 'CRITICO' removido — nenhum produtor da cadeia (Luna Python / .NET) emite
// esse nível de urgência. Era UI para dado que não existe (mesma classe do achado D-5
// dos cards de sub-serviço abaixo).
type UrgLevel = 'BAIXO' | 'MEDIO' | 'ALTO';

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: 7, label: STRINGS.LUNA.PERIODO_7 },
  { value: 30, label: STRINGS.LUNA.PERIODO_30 },
  { value: 90, label: STRINGS.LUNA.PERIODO_90 },
];

// CQ-09/D-5 (ruling já decidida, não reaberta aqui): os 3 cards antigos (twilio/oracle/
// visaoComputacional) não tinham produtor nenhum — nem twilio nem visaoComputacional
// existem em endpoint algum da Luna. Trocados pelos 2 campos reais que GET /ready
// devolve.
const SERVICO_META: Record<'oracle' | 'kura_api', { label: string; icon: KCIconName }> = {
  oracle: { label: 'Oracle DB', icon: 'more' },
  kura_api: { label: 'API Kura', icon: 'share' },
};

const URG_LEVELS: UrgLevel[] = ['BAIXO', 'MEDIO', 'ALTO'];

// getLunaHealth() nunca rejeita: quando a Luna está fora do ar ela resolve com
// {status: 'indisponivel'} em vez de lançar. Este type guard estreita a união antes de
// acessar oracle/kura_api — sem ele o acesso direto é um crash real em runtime.
// CQ-09: o guard antigo testava 'sgStatus', uma chave que nunca existiu em nenhum
// endpoint real da Luna — resultado medido: sempre falso em modo real, a tela sempre
// mostrava "Offline" com a Luna perfeitamente no ar.
// CQ-09 fix wave (G2 Important-1): testar 'oracle' tinha o MESMO modo de falha — é
// outra chave do corpo do upstream, cujo shape não foi reverificado contra a Luna
// real (ver limite declarado em LunaReadyResponse). Se a Luna renomear/omitir
// `oracle`, o guard voltaria a falhar e a tela voltaria a mostrar "Offline" com a
// Luna no ar. 'httpStatus' não depende do corpo do upstream — é anexado só no
// caminho de sucesso de getLunaHealth() (luna.service.ts: `{...data, httpStatus:
// status}`), nunca no caminho de erro (`{status:'indisponivel'}`), então é um
// discriminante estável mesmo que o shape real do corpo mude.
function isLunaHealthUp(
  health: LunaHealthResult | undefined,
): health is Exclude<LunaHealthResult, { status: 'indisponivel' }> {
  return health != null && 'httpStatus' in health;
}

// CQ-09: o tipo exato de oracle/kura_api (enum? boolean? string livre?) não foi
// reverificado contra a Luna real nesta sessão — tratado como string opaca, comparada
// de forma defensiva e case-insensitive contra algo como 'ok'/'up'. Ver
// LunaReadyResponse (src/types/api.ts) para o limite declarado.
// CQ-09 fix wave (G2 Important-1): aceita undefined/null além de string — desde que
// isLunaHealthUp() não dependa mais de uma chave específica do corpo (ver acima), uma
// chave individual como `oracle` pode estar ausente sem que isso seja um crash; nesse
// caso trata como "não confirmado up", não lança.
function isServicoUp(valor: string | undefined | null): boolean {
  if (valor == null) return false;
  const v = valor.toLowerCase();
  return v === 'ok' || v === 'up';
}

function urgColor(level: UrgLevel, colors: typeof lightColors): string {
  switch (level) {
    case 'BAIXO': return colors.success;
    case 'MEDIO': return colors.warning;
    case 'ALTO':  return colors.amber;
  }
}

function urgLabel(level: UrgLevel): string {
  switch (level) {
    case 'BAIXO': return 'Baixo';
    case 'MEDIO': return 'Médio';
    case 'ALTO':  return 'Alto';
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

  // E14 (CQ-09 ledger, pré-requisito dos itens 1-3 desta task): dataFim = "hoje" sem
  // componente de hora vira 00:00:00 do dia no .NET, que filtra <= — toda triagem
  // gravada com UtcNow (hora real) de hoje caía fora do relatório de hoje. Manda o dia
  // SEGUINTE como limite superior EXCLUSIVO de dia, cobrindo qualquer hora de hoje,
  // sem precisar de componente de hora no formato ISO (formatDateISO só emite
  // yyyy-MM-dd). Sem este fix, os itens 1-3 (nomes de campo/vocabulário) entregariam
  // "uma tela bonita que continua mostrando zero".
  const dataFim = formatDateISO(addDays(new Date(), 1));
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

  // Luna fora do ar (indisponível — falha de rede/timeout genuína) cai no ramo visual
  // "Offline": vermelho. Nunca acessa oracle/kura_api sem antes confirmar que a união
  // não é {status:'indisponivel'}.
  const healthUp = isLunaHealthUp(health);

  // CQ-09: /ready devolve HTTP 503 (corpo ainda válido, não falha de rede) quando algo
  // está degradado — httpStatus carrega essa distinção desde luna.service.ts. Reforça
  // com o próprio corpo (oracle/kura_api) por defensividade, mesmo que a implementação
  // real hoje só use o 503 para sinalizar isso — não inventa um 4º estado além de
  // Offline/Online/Degradado.
  const degradado = healthUp
    ? health.httpStatus === 503 || !isServicoUp(health.oracle) || !isServicoUp(health.kura_api)
    : false;

  const statusColor = !healthUp
    ? colors.danger
    : degradado
      ? colors.warning
      : colors.success;

  const statusLabel = !healthUp
    ? STRINGS.LUNA.STATUS_OFFLINE
    : degradado
      ? STRINGS.LUNA.STATUS_DEGRADADO
      : STRINGS.LUNA.STATUS_ONLINE;

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
            const isUp = isServicoUp(health[key]);
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
