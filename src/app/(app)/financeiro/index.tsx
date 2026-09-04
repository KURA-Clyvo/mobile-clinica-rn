import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { useRequireGestor } from '@hooks/useIsGestor';
import { useResumoFinanceiro } from '@hooks/useFinanceiro';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCCard } from '@components/primitives/KCCard';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCEmptyState } from '@components/primitives/KCEmptyState';
import { MetricCard } from '@components/domain/MetricCard';
import { STRINGS } from '@constants/strings';
import { formatarMoeda, formatarPercentual } from '@utils/moeda';
import { mesCorrente, formatarPeriodoCurto } from '@utils/periodoFinanceiro';
import type { MixPorServico } from '../../../types/api';

// FM-08 (ciclo FIN) — painel de gestão, tela nova, GESTOR-only (ruling D-16). Ponto de
// entrada: settings.tsx (seção "Financeiro") e o link "Ver painel completo" da seção
// financeira de dashboard.tsx (FM-07/FM-08).
//
// 🔴 PAPEL-ONLY, não ficha+papel — `useRequireGestor()` sozinho, sem o padrão de guarda de
// FICHA da FM-01 (`consulta`/`receituario`). Combinar as duas guardas na MESMA tela dispara
// DOIS `useEffect` independentes para destinos diferentes quando os dois predicados falham
// juntos (armadilha documentada em `useIsGestor.ts`, "AVISO PARA A FM-02/FM-06") — este
// painel é administração financeira, não atendimento clínico, não tem ficha para assinar.
//
// 🔴 MESMO PERÍODO do dashboard (`mesCorrente()`, sem seletor de período nesta task — §2.5
// do brief: o mock não replica as regras de 400 do validator de período, então um seletor
// livre teria "sucesso" no mock e 400 no real; documentado como próximo passo, não
// implementado aqui). Consequência OBSERVÁVEL: com o mesmo período do dashboard, o React
// Query serve do CACHE (`queryKey: ['financeiro','resumo',de,ate]`, `staleTime: 30s`) — abrir
// este painel logo depois do dashboard não dispara uma segunda chamada de rede.
//
// 🔴 Pull-to-refresh usa `refetch` DIRETO, sem a guarda condicional que `dashboard.tsx` usa
// (`...(isGestor ? [refetchFinanceiro()] : [])`). A guarda ali existe porque o dashboard
// RENDERIZA para todo perfil (a seção financeira só se ESCONDE no JSX para VETERINARIO, mas o
// componente inteiro monta). Aqui é diferente: `useRequireGestor()` devolve `false` e a tela
// inteira renderiza `null` (linha "if (!podeVer) return null" abaixo) ANTES de qualquer JSX
// que chame `refetch` existir na árvore — um VETERINARIO nunca monta o `RefreshControl` desta
// tela, então não existe caminho para ele disparar `refetch()` bypassando `enabled`.

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
      marginBottom: 4,
    },
    backButton: {
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -10,
    },
    headerTitle: { fontFamily: 'Cormorant_500Medium', fontSize: 24, color: colors.text },
    periodoText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      marginBottom: 16,
    },
    sectionBlock: { marginBottom: 24 },
    sectionTitle: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
      marginBottom: 4,
    },
    sectionCaption: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      marginBottom: 12,
    },
    metricsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    skeletonCard: { flex: 1, height: 100, borderRadius: 20, opacity: 0.45 },
    comparacaoCard: { gap: 4 },
    comparacaoPeriodos: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
    },
    comparacaoValor: {
      fontFamily: 'Cormorant_500Medium',
      fontSize: 22,
      color: colors.text,
      marginTop: 4,
    },
    mixCard: { marginBottom: 10 },
    mixRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 8,
    },
    mixNome: { fontFamily: 'Lexend_500Medium', fontSize: 14, color: colors.text, flex: 1 },
    mixReceita: { fontFamily: 'Lexend_500Medium', fontSize: 14, color: colors.text },
    // Barra proporcional: `View` com `width` percentual sobre um "trilho" de fundo -- decisão
    // #1 do brief (ver comentário de escolha de layout logo acima do componente MixRow,
    // abaixo). Sem biblioteca de gráfico (proibido pelo brief).
    mixBarTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.bgSunk,
      overflow: 'hidden',
    },
    mixBarFill: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
    },
    mixCaptionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    mixCaptionText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 11,
      color: colors.textMute,
    },
  });

interface MixRowProps {
  item: MixPorServico;
  receitaBruta: number;
  styles: ReturnType<typeof makeStyles>;
}

// Item da lista do mix -- decisão #1 do brief: escolhi CARD + BARRA PROPORCIONAL (não tabela,
// não lista simples de valor+contagem). Razão medida: uma TABELA exigiria colunas alinhadas
// (nome/receita/nº cobranças/%) que não cabem confortavelmente na largura de tela de um
// celular sem truncar o nome do serviço -- o app não tem componente de tabela responsiva
// hoje, construir um só para esta tela custaria mais do que o ganho. Uma LISTA simples
// (texto "nome — R$ X — N cobranças") comunica os números mas não comunica a PROPORÇÃO de
// cada balde sobre o total de forma imediata -- que é justamente o que um "mix" precisa
// transmitir para o gestor decidir onde focar. O card com barra dá os 2 números exatos (nome,
// receita, contagem) MAIS uma leitura visual instantânea da proporção, ao custo de mais
// altura vertical por item (aceitável: o mix normalmente tem poucos baldes, não uma lista
// longa).
function MixRow({ item, receitaBruta, styles }: MixRowProps) {
  // 🔴 §3 do brief -- a % da barra é SÓ EXIBIÇÃO (largura visual), nunca um número monetário.
  // `receitaBruta === 0` é alcançável (FM-06 permite cortesia com `vlCobrado: 0` em TODAS as
  // cobranças do período) -- guarda contra divisão por zero explícita, não implícita via NaN.
  const pct = receitaBruta === 0 ? 0 : (item.receita / receitaBruta) * 100;
  // Reaproveita a MESMA lógica de formatação de `formatarPercentual` (troca separador, sem
  // re-arredondar) mas SEM o sinal "+" -- aqui não é uma VARIAÇÃO (que pode ser negativa), é
  // uma FATIA de um total (sempre >= 0). `formatarPercentual` adicionaria um "+" que não faz
  // sentido para "37% do total" -- por isso não é reusada aqui, é uma formatação local com
  // semântica diferente.
  const pctLabel = `${pct.toFixed(1).replace('.', ',')}%`;

  return (
    <KCCard style={styles.mixCard} testID="mix-item">
      <View style={styles.mixRow}>
        <Text style={styles.mixNome} testID="mix-nome">
          {item.nmServico}
        </Text>
        <Text style={styles.mixReceita} testID="mix-receita">
          {formatarMoeda(item.receita)}
        </Text>
      </View>
      <View style={styles.mixBarTrack}>
        <View style={[styles.mixBarFill, { width: `${Math.min(pct, 100)}%` }]} testID="mix-barra" />
      </View>
      <View style={styles.mixCaptionRow}>
        <Text style={styles.mixCaptionText} testID="mix-cobrancas">
          {item.nrCobrancas} cobrança{item.nrCobrancas === 1 ? '' : 's'}
        </Text>
        <Text style={styles.mixCaptionText} testID="mix-percentual">
          {pctLabel}
        </Text>
      </View>
    </KCCard>
  );
}

export default function FinanceiroScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const podeVer = useRequireGestor();

  const { de, ate } = mesCorrente();
  const { data: resumo, isLoading, isFetching, isError, refetch } = useResumoFinanceiro(de, ate);

  // Regra dos hooks: todos incondicionais, ANTES do guard de render abaixo -- mesmo padrão de
  // servicos-preco/index.tsx e usuarios/index.tsx.
  if (!podeVer) return null;

  return (
    <ScreenContainer
      refreshControl={
        // I-1 da G2 da FM-08: `isLoading` (== isPending && isFetching, ver useFinanceiro.ts)
        // fica `false` para sempre depois da 1ª carga -- um `RefreshControl` ligado a ele
        // nunca gira de novo, mesmo com refetch em voo. `isFetching` é o sinal certo: `true`
        // tanto na carga inicial quanto em qualquer refetch subsequente.
        <RefreshControl refreshing={isFetching} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          testID="btn-voltar-financeiro"
          accessibilityLabel="Voltar"
        >
          <KCIcon name="back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{STRINGS.financeiroPainel.titulo}</Text>
      </View>

      {resumo != null && (
        <Text style={styles.periodoText} testID="financeiro-painel-periodo">
          {formatarPeriodoCurto(resumo.periodo.de, resumo.periodo.ate)}
        </Text>
      )}

      {isLoading ? (
        <View style={styles.metricsRow} testID="financeiro-painel-skeleton">
          <View testID="skeleton" style={[styles.skeletonCard, { backgroundColor: colors.border }]} />
          <View testID="skeleton" style={[styles.skeletonCard, { backgroundColor: colors.border }]} />
        </View>
      ) : isError || resumo == null ? (
        // 🔴 Mesma doutrina do dashboard (I-1 da G2 da FM-07) -- "não sei" NÃO é "não houve".
        // `resumo` é `undefined` tanto quando o período não teve cobrança quanto quando a
        // chamada FALHOU -- este ramo vem ANTES do vazio, e a ordem É o fix.
        <KCEmptyState
          icon="alert"
          title={STRINGS.dashboard.erroFinanceiro}
          description={STRINGS.dashboard.erroFinanceiroDesc}
          testID="erro-financeiro-painel"
        />
      ) : resumo.nrCobrancas === 0 ? (
        // §2.4 do brief -- gate é SEMPRE nrCobrancas === 0, nunca receitaBruta === 0 (cortesia
        // total tem receitaBruta 0 e nrCobrancas > 0, e "nenhuma cobrança" seria falso).
        <KCEmptyState
          icon="dashboard"
          title={STRINGS.dashboard.semFaturamento}
          description={STRINGS.dashboard.semFaturamentoDesc}
          testID="empty-financeiro-painel"
        />
      ) : (
        <>
          <View style={styles.metricsRow} testID="financeiro-painel-row">
            <MetricCard
              label={STRINGS.dashboard.receitaBruta}
              value={formatarMoeda(resumo.receitaBruta)}
              icon="dashboard"
              tone="sage"
            />
            <MetricCard
              label={STRINGS.dashboard.ticketMedio}
              value={resumo.ticketMedio == null ? '—' : formatarMoeda(resumo.ticketMedio)}
              icon="check"
              tone="ocean"
            />
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>{STRINGS.financeiroPainel.comparacaoTitulo}</Text>
            <KCCard style={styles.comparacaoCard} testID="financeiro-painel-comparacao-card">
              <Text style={styles.comparacaoPeriodos} testID="financeiro-painel-periodos">
                {formatarPeriodoCurto(resumo.periodoAnterior.de, resumo.periodoAnterior.ate)}
                {' → '}
                {formatarPeriodoCurto(resumo.periodo.de, resumo.periodo.ate)}
              </Text>
              {/* Mesma lógica do card do dashboard (item 2 do brief) -- variacaoPercentual
                  JÁ vem pronto (não recalcula, não faz segunda chamada). null NÃO é "0%": só
                  ocorre quando a receita do período anterior é zero -- frase honesta com os
                  números crus. */}
              <Text style={styles.comparacaoValor} testID="financeiro-painel-comparacao-valor">
                {resumo.variacaoPercentual == null
                  ? `${STRINGS.dashboard.semBaseComparacao} (${formatarMoeda(
                      resumo.receitaBrutaPeriodoAnterior,
                    )} → ${formatarMoeda(resumo.receitaBruta)})`
                  : `${formatarPercentual(resumo.variacaoPercentual)} ${
                      STRINGS.dashboard.comparacaoPeriodoAnterior
                    }`}
              </Text>
              {resumo.variacaoPercentual != null && (
                <Text style={styles.comparacaoPeriodos} testID="financeiro-painel-comparacao-base">
                  {formatarMoeda(resumo.receitaBrutaPeriodoAnterior)} → {formatarMoeda(resumo.receitaBruta)}
                </Text>
              )}
            </KCCard>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>{STRINGS.financeiroPainel.mixTitulo}</Text>
            <Text style={styles.sectionCaption}>{STRINGS.financeiroPainel.mixCaption}</Text>
            {/* 🔴 O mix RECONCILIA: soma das receitas dos baldes == receitaBruta, exato
                (invariante do backend). Renderiza TODO item do array, na ORDEM que o backend
                devolve (maior receita primeiro, já ordenado no servidor -- não reordena aqui)
                -- nenhum balde escondido, nenhum "outros" agrupado sem somar.
                `idServicoPreco: null` (avulso, D-2) e serviço desativado (nome preservado)
                aparecem como qualquer outro balde -- não são casos especiais na exibição. */}
            <View testID="mix-lista">
              {resumo.mixPorServico.map((item) => (
                <MixRow
                  key={item.idServicoPreco ?? 'avulso'}
                  item={item}
                  receitaBruta={resumo.receitaBruta}
                  styles={styles}
                />
              ))}
            </View>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}
