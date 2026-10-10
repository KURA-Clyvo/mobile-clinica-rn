import React, { useState } from 'react';
import { View, Text, StyleSheet, RefreshControl } from 'react-native';
import { avisar } from '@components/feedback/confirmar';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors, spacing } from '@theme/tokens';
import { useLunaHealth, useRelatorioTriagens, useTriagens } from '@hooks/useLuna';
import { useAlertas } from '@hooks/useDashboard';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCCard } from '@components/primitives/KCCard';
import { KCChip } from '@components/primitives/KCChip';
import { TriagemCard } from '@components/domain/TriagemCard';
import { URGENCIA_VISUAL } from '@utils/triagem';
import type { Urgencia } from '@utils/triagem';
import { KCButton } from '@components/primitives/KCButton';
import { QueryState } from '@components/feedback/QueryState';
import { Skeleton } from '@components/feedback/Skeleton';
import { KCEmptyState } from '@components/primitives/KCEmptyState';
import { AlertCard } from '@components/domain/AlertCard';
import { WhatsAppModal } from '@components/domain/WhatsAppModal';
import { getTutorById, telefoneDisponivel } from '@services/tutores.service';
import { calcularIntervaloPeriodo } from '@utils/date';
import { ROUTES } from '@constants/routes';
import { STRINGS } from '@constants/strings';
import type { LunaHealthResult } from '@services/luna.service';
import type { TriagemListaItem } from '../../types/api';

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
function isServicoUp(valor: boolean | string | undefined | null): boolean {
  if (valor == null) return false;
  // A Luna real devolve booleano (ver LunaReadyResponse); string fica por compatibilidade.
  if (typeof valor === 'boolean') return valor;
  const v = valor.toLowerCase();
  return v === 'ok' || v === 'up';
}

// BR-CLI-T07 (M-2 da T01): o relatorio fala BAIXO/MEDIO/ALTO, a fila BAIXA/MEDIA/ALTA; os
// dois leem a MESMA tabela (utils/triagem.ts) -- Alta = clayInk, Media = amberInk, Baixa = textMute,
// de luminosidades diferentes. Vocabulario unico: Alta/Média/Baixa (BR-CLI-13).
const URG_RELATORIO: Record<UrgLevel, Urgencia> = { BAIXO: 'BAIXA', MEDIO: 'MEDIA', ALTO: 'ALTA' };

function urgColor(level: UrgLevel, colors: typeof lightColors): string {
  return colors[URGENCIA_VISUAL[URG_RELATORIO[level]].grafico];
}

function urgLabel(level: UrgLevel): string {
  return URGENCIA_VISUAL[URG_RELATORIO[level]].label;
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
      color: colors.textMuteInk,
      marginTop: 2,
    },
    statusIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    statusText: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 12,
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
    alertasSection: { paddingHorizontal: 16, marginTop: 16, marginBottom: 24 },
    alertasTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
      marginBottom: 10,
    },
    // LU-09 — Fila da Luna
    filaTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
      marginBottom: 10,
    },
    filaErro: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 13,
      color: colors.danger,
      textAlign: 'center',
      paddingVertical: 16,
    },
  });

export default function LunaScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const qc = useQueryClient();
  const router = useRouter();
  const [periodo, setPeriodo] = useState<Periodo>(7);
  const [refreshing, setRefreshing] = useState(false);
  // LU-09: alvo do WhatsAppModal, preenchido depois de GET /tutores/{id} resolver.
  const [whatsappAlvo, setWhatsappAlvo] = useState<{
    nmPet: string;
    nmTutor: string;
    dsTelefone: string;
  } | null>(null);
  // idTriagem em voo (busca de telefone) — desabilita/mostra spinner só no card certo.
  const [buscandoTelefoneId, setBuscandoTelefoneId] = useState<number | null>(null);

  // E14 (CQ-09 ledger, pré-requisito dos itens 1-3 desta task): dataFim = "hoje" sem
  // componente de hora vira 00:00:00 do dia no .NET, que filtra <= — toda triagem
  // gravada com UtcNow (hora real) de hoje caía fora do relatório de hoje. Manda o dia
  // SEGUINTE como limite superior EXCLUSIVO de dia, cobrindo qualquer hora de hoje,
  // sem precisar de componente de hora no formato ISO (formatDateISO só emite
  // yyyy-MM-dd). Sem este fix, os itens 1-3 (nomes de campo/vocabulário) entregariam
  // "uma tela bonita que continua mostrando zero".
  // LU-09 fix wave 1 (G2-2): a conta de dataInicio/dataFim foi extraída para
  // calcularIntervaloPeriodo() (utils/date.ts) — o chip "90 dias" mandava 91 dias
  // (dataFim=hoje+1 SOMADO a dataInicio=hoje-90) e o .NET recusava com 422
  // (LunaService.cs:166, teto de 90 dias). Vale para a Fila E o relatório, que usam
  // o mesmo par dataInicio/dataFim.
  const { dataInicio, dataFim } = calcularIntervaloPeriodo(periodo);

  // `isError` do health: o service já devolve 'indisponivel' quando a chamada falha, mas se a
  // própria query errar (ex.: exceção fora do service) o status NÃO pode ficar em "Online".
  const { data: health, isError: healthComErro } = useLunaHealth();
  const relatorioQuery = useRelatorioTriagens({
    dataInicio,
    dataFim,
  });
  const { data: relatorio } = relatorioQuery;
  const {
    data: fila,
    isLoading: loadingFila,
    isError: filaComErro,
  } = useTriagens({ dataInicio, dataFim, pageSize: 20 });
  const alertasQuery = useAlertas();

  const onRefresh = async () => {
    setRefreshing(true);
    await qc.invalidateQueries({ queryKey: ['luna'] });
    setRefreshing(false);
  };

  // LU-09: "Responder no WhatsApp" — busca o telefone por GET /tutores/{id} (o item
  // da fila NUNCA carrega telefone, de propósito/LGPD). `item.tutor === null` já
  // esconde a ação no JSX (ver abaixo) — esta guarda é defesa em profundidade.
  const handleResponderWhatsApp = async (item: TriagemListaItem) => {
    if (!item.tutor) return;
    setBuscandoTelefoneId(item.idTriagem);
    try {
      const tutor = await getTutorById(item.tutor.id);
      // LU-09 fix wave 1 (item 2, G2-3): o telefone só é conhecido DEPOIS deste
      // fetch (a fila nunca carrega telefone, LGPD) — por isso a checagem do
      // sentinela "Não informado"/vazio não pode acontecer no JSX do botão (que
      // roda antes do fetch): ela vira "não oferece o modal" em vez de "não
      // renderiza o botão". Sem telefone real, mandar {para} para a Luna resultaria
      // em 502 (Twilio rejeita o destinatário).
      if (!telefoneDisponivel(tutor.nrTelefone)) {
        void avisar({
          titulo: 'Telefone não cadastrado',
          mensagem: 'Este tutor não tem telefone cadastrado. Não é possível responder pelo WhatsApp.',
        });
        return;
      }
      setWhatsappAlvo({
        nmPet: item.pets[0]?.nome ?? '',
        nmTutor: tutor.nmTutor,
        dsTelefone: tutor.nrTelefone,
      });
    } catch {
      void avisar({ titulo: 'Erro', mensagem: 'Não foi possível buscar o telefone do tutor.' });
    } finally {
      setBuscandoTelefoneId(null);
    }
  };

  // LU-09: "Abrir paciente" só existe em ALTA com exatamente 1 pet — critério de
  // aceite literal do backlog. Mais de 1 pet (ou nenhum) não sabe para qual navegar.
  const handleAbrirPaciente = (item: TriagemListaItem) => {
    if (item.pets.length !== 1) return;
    router.push(ROUTES.app.pacienteDetalhe(item.pets[0]!.id));
  };

  // REC-14 — "Agendar" pela fila da Luna. `item.tutor === null` (E34: a triagem não
  // sabe o pet, e aqui nem o tutor foi identificado) leva ao cadastro de tutor
  // (REC-03) em vez do formulário de agendamento — o botão some nesse caso e vira
  // "Cadastrar tutor" (ver JSX abaixo), nunca chama esta função.
  const handleAgendar = (item: TriagemListaItem) => {
    if (!item.tutor) return;
    router.push(
      ROUTES.app.agendaNovo({ idTutor: item.tutor.id, idTriagemOrigem: item.idTriagem }),
    );
  };

  // Luna fora do ar (indisponível — falha de rede/timeout genuína) cai no ramo visual
  // "Offline": vermelho. Nunca acessa oracle/kura_api sem antes confirmar que a união
  // não é {status:'indisponivel'}.
  const healthUp = !healthComErro && isLunaHealthUp(health);

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

      {/* C6 (BR-CLI-T07): a telemetria Oracle/API Kura saiu daqui; vive em Configuracoes (gestor). */}

      {/* FILA DA LUNA (LU-09) */}
      <View style={styles.section}>
        <Text style={styles.filaTitle}>{STRINGS.LUNA.FILA_TITLE}</Text>
      </View>
      {loadingFila ? (
        <KCCard style={styles.reportCard}>
          <Skeleton variant="line" count={2} testID="skeleton-fila" />
        </KCCard>
      ) : filaComErro ? (
        // Erro de rede != estado vazio — nunca mostrar "nenhuma mensagem" quando a
        // chamada falhou de verdade (critério de aceite literal do backlog).
        <Text style={styles.filaErro} testID="fila-erro">
          {STRINGS.LUNA.FILA_ERRO}
        </Text>
      ) : !fila || fila.items.length === 0 ? (
        <KCEmptyState
          icon="luna"
          title={STRINGS.LUNA.EMPTY_FILA}
          description={STRINGS.LUNA.EMPTY_FILA_DESC}
          testID="empty-fila"
          style={{ paddingHorizontal: 16 }}
        />
      ) : (
        <View style={styles.section} testID="fila-luna-lista">
          {fila.items.map((item) => (
            <TriagemCard key={item.idTriagem} item={item}>
                {item.tutor && (
                  <KCButton
                    variant="secondary"
                    size="sm"
                    loading={buscandoTelefoneId === item.idTriagem}
                    disabled={buscandoTelefoneId === item.idTriagem}
                    onPress={() => handleResponderWhatsApp(item)}
                    testID={`btn-responder-whatsapp-${item.idTriagem}`}
                  >
                    {STRINGS.LUNA.RESPONDER_WHATSAPP}
                  </KCButton>
                )}
                {item.urgencia === 'ALTA' && item.pets.length === 1 && (
                  <KCButton
                    variant="ghost"
                    size="sm"
                    onPress={() => handleAbrirPaciente(item)}
                    testID={`btn-abrir-paciente-${item.idTriagem}`}
                  >
                    {STRINGS.LUNA.ABRIR_PACIENTE}
                  </KCButton>
                )}
                {/* REC-14 — E34: tutor identificado ⇒ "Agendar" (abre o formulário com
                    idTutor/idTriagemOrigem preenchidos, pet fica em aberto — a triagem
                    não sabe o pet); tutor null ⇒ "Cadastrar tutor" (leva à REC-03),
                    NUNCA chama handleAgendar. */}
                {item.tutor ? (
                  <KCButton
                    variant="ghost"
                    size="sm"
                    onPress={() => handleAgendar(item)}
                    testID={`btn-agendar-${item.idTriagem}`}
                  >
                    {STRINGS.LUNA.AGENDAR}
                  </KCButton>
                ) : (
                  <KCButton
                    variant="ghost"
                    size="sm"
                    onPress={() => router.push(ROUTES.app.tutorNovo)}
                    testID={`btn-cadastrar-tutor-${item.idTriagem}`}
                  >
                    {STRINGS.LUNA.CADASTRAR_TUTOR}
                  </KCButton>
                )}
            </TriagemCard>
          ))}
        </View>
      )}

      {whatsappAlvo && (
        <WhatsAppModal
          visible={!!whatsappAlvo}
          onClose={() => setWhatsappAlvo(null)}
          nmPet={whatsappAlvo.nmPet}
          nmTutor={whatsappAlvo.nmTutor}
          dsTelefone={whatsappAlvo.dsTelefone}
        />
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
        <QueryState
          query={relatorioQuery}
          isEmpty={() => false}
          skeleton={<Skeleton variant="line" count={4} />}
          empty={null}
          errorTitle="Não foi possível carregar o relatório de triagens"
        >
          {() => (
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
        </QueryState>
      </KCCard>

      {/* ALERTAS */}
      <View style={styles.alertasSection}>
        <Text style={styles.alertasTitle}>{STRINGS.LUNA.ALERTAS_TITLE}</Text>
        <QueryState
          query={alertasQuery}
          empty={
            <KCEmptyState
              icon="alert"
              title={STRINGS.LUNA.EMPTY_ALERTAS}
              description={STRINGS.LUNA.EMPTY_ALERTAS_DESC}
              testID="empty-alertas"
            />
          }
          errorTitle="Não foi possível carregar os alertas"
        >
          {(alertas) => (
            <>
              {alertas.map((alerta) => (
                <AlertCard key={alerta.id} alerta={alerta} />
              ))}
            </>
          )}
        </QueryState>
      </View>
    </ScreenContainer>
  );
}
