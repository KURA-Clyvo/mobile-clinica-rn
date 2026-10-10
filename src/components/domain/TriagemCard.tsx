import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@theme/index';
import { fontSize, fonts, lightColors, spacing, touchTarget } from '@theme/tokens';
import { KCCard } from '@components/primitives/KCCard';
import { KCChip } from '@components/primitives/KCChip';
import { STRINGS } from '@constants/strings';
import { formatRelativeTime } from '@utils/date';
import { URGENCIA_VISUAL, destacarTrecho } from '@utils/triagem';
import type { TriagemListaItem } from '../../types/api';

// BR-CLI-T07 -- card de triagem AUDITAVEL (canvas ClinicaTriagem v13). Mostra por que o caso
// subiu na fila: o nivel, as palavras do nivel vencedor DENTRO da mensagem, a pontuacao e a
// versao das regras. Sem tabela por sintoma e sem "Abrir conversa" (BE-03/BE-04 fora do ciclo).
// `sintomas` ja sao as palavras do nivel vencedor; `score` soma TODOS os niveis (V4-I1) --
// por isso a nota explicativa abaixo, para ninguem ler o score como "pontos do nivel".
// Tocar o card expande a mensagem inteira; nao ha endpoint novo (o trecho vem da lista).

export interface TriagemCardProps {
  item: TriagemListaItem;
  /** Botoes de acao (WhatsApp, Abrir paciente, Agendar), renderizados abaixo da auditoria. */
  children?: React.ReactNode;
}

export function TriagemCard({ item, children }: TriagemCardProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [aberto, setAberto] = useState(false);
  const visual = URGENCIA_VISUAL[item.urgencia];
  const trecho = item.trechoMensagem;
  const segmentos = trecho ? destacarTrecho(trecho, item.sintomas) : [];
  const achouNoTrecho = segmentos.some((s) => s.destaque);
  const id = item.idTriagem;

  return (
    <KCCard style={styles.card} testID={`fila-card-${id}`}>
      <Pressable
        onPress={() => setAberto((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        accessibilityLabel={aberto ? STRINGS.LUNA.TRIAGEM_RECOLHER : STRINGS.LUNA.TRIAGEM_VER_MENSAGEM}
        style={styles.toque}
        testID={`fila-toque-${id}`}
      >
        <View style={styles.header}>
          <KCChip tone={visual.chipTone} testID={`fila-urg-${id}`}>
            {visual.label}
          </KCChip>
          <Text style={styles.tempo} testID={`fila-tempo-${id}`}>
            {formatRelativeTime(item.dtTriagem)}
          </Text>
        </View>
        {item.pets[0] && (
          <Text style={styles.pet} testID={`fila-pet-${id}`}>
            {item.pets[0].nome}
          </Text>
        )}
        {trecho ? (
          <Text
            style={styles.trecho}
            numberOfLines={aberto ? undefined : 2}
            testID={`fila-trecho-${id}`}
          >
            {segmentos.map((s, i) =>
              s.destaque ? (
                <Text key={i} style={styles.destaque} testID={`fila-destaque-${id}`}>
                  {s.texto}
                </Text>
              ) : (
                s.texto
              ),
            )}
          </Text>
        ) : null}
        {item.sintomas.length > 0 && (!trecho || !achouNoTrecho) && (
          <View style={styles.chips}>
            <KCChip tone="mute" testID={`fila-disparou-${id}`}>
              {STRINGS.LUNA.TRIAGEM_DISPAROU(item.sintomas.join(', '))}
            </KCChip>
          </View>
        )}
        <View style={styles.metricas}>
          {item.score != null && (
            <View style={styles.metrica}>
              <Text style={styles.rotulo}>{STRINGS.LUNA.TRIAGEM_PONTUACAO}</Text>
              <Text style={styles.dado} testID={`fila-score-${id}`}>
                {item.score}
              </Text>
            </View>
          )}
          {item.regrasVersao != null && (
            <Text style={styles.dado} testID={`fila-regras-${id}`}>
              {STRINGS.LUNA.TRIAGEM_REGRAS(item.regrasVersao)}
            </Text>
          )}
        </View>
        {aberto && (
          <View testID={`fila-detalhe-${id}`}>
            {item.sintomas.length > 0 && (
              <Text style={styles.subiu}>
                {STRINGS.LUNA.TRIAGEM_SUBIU}: {item.sintomas.join(', ')}
              </Text>
            )}
            <Text style={styles.nota}>{STRINGS.LUNA.TRIAGEM_NOTA_SCORE}</Text>
            <Text style={styles.nota}>{STRINGS.LUNA.TRIAGEM_NOTA_EQUIPE}</Text>
          </View>
        )}
      </Pressable>
      {children ? <View style={styles.acoes}>{children}</View> : null}
    </KCCard>
  );
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    card: { marginBottom: spacing[3] },
    toque: { minHeight: touchTarget.min },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tempo: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.textMuteInk },
    pet: { fontFamily: fonts.bodyMedium, fontSize: fontSize.base, color: colors.text, marginTop: spacing[2] },
    trecho: {
      fontFamily: fonts.body,
      fontSize: fontSize.sm,
      lineHeight: fontSize.sm * 1.5,
      color: colors.textSoft,
      marginTop: spacing[2],
    },
    destaque: { backgroundColor: colors.amberPale, color: colors.text, fontFamily: fonts.bodyMedium },
    chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[2] },
    metricas: { flexDirection: 'row', alignItems: 'center', gap: spacing[4], marginTop: spacing[3] },
    metrica: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
    rotulo: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.textMuteInk },
    dado: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.textSoft },
    subiu: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: colors.text, marginTop: spacing[3] },
    nota: { fontFamily: fonts.body, fontSize: fontSize.xs, color: colors.textSoft, marginTop: spacing[2] },
    acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  });
