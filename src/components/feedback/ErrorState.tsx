import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors, spacing } from '@theme/tokens';
import { typography } from '@theme/typography';
import { KCButton } from '@components/primitives/KCButton';
import { KCIcon } from '@components/primitives/KCIcon';

// Erro de carregamento (BR-CLI-02): diz o que aconteceu SEM culpar a internet do usuário (a
// falha pode ser do servidor) e oferece a ação. O botão é o KCButton `md` (48px >= 44).
export const ERRO_TITULO_PADRAO = 'Não foi possível carregar';
export const ERRO_DESCRICAO_PADRAO = 'Os dados não chegaram. Tente de novo em instantes.';
export const ROTULO_TENTAR_DE_NOVO = 'Tentar de novo';

export interface ErrorStateProps {
  titulo?: string;
  descricao?: string;
  onRetry: () => void;
  /** Linha curta (texto + botão) para dado auxiliar de formulário, em vez do bloco centrado. */
  compacto?: boolean;
  testID?: string;
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    caixa: { alignItems: 'center', paddingVertical: spacing[8], paddingHorizontal: spacing[6], gap: spacing[2] },
    titulo: { ...typography.bodyMedium, color: colors.text, textAlign: 'center', marginTop: spacing[2] },
    descricao: { ...typography.body, color: colors.textSoft, textAlign: 'center' },
    acao: { marginTop: spacing[3] },
    linha: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing[2] },
    linhaTexto: { ...typography.body, color: colors.text, flexShrink: 1 },
  });

export function ErrorState({ titulo, descricao, onRetry, compacto, testID = 'error-state' }: ErrorStateProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  if (compacto) {
    return (
      <View style={styles.linha} testID={testID} accessibilityRole="alert">
        <Text style={styles.linhaTexto}>{titulo ?? ERRO_TITULO_PADRAO}.</Text>
        <KCButton
          variant="ghost"
          size="sm"
          onPress={onRetry}
          testID={`${testID}-retry`}
          accessibilityLabel={ROTULO_TENTAR_DE_NOVO}
        >
          {ROTULO_TENTAR_DE_NOVO}
        </KCButton>
      </View>
    );
  }
  return (
    <View style={styles.caixa} testID={testID} accessibilityRole="alert">
      <KCIcon name="alert" size={40} color={colors.textMuteInk} />
      <Text style={styles.titulo}>{titulo ?? ERRO_TITULO_PADRAO}</Text>
      <Text style={styles.descricao}>{descricao ?? ERRO_DESCRICAO_PADRAO}</Text>
      <KCButton
        variant="secondary"
        onPress={onRetry}
        style={styles.acao}
        testID={`${testID}-retry`}
        accessibilityLabel={ROTULO_TENTAR_DE_NOVO}
      >
        {ROTULO_TENTAR_DE_NOVO}
      </KCButton>
    </View>
  );
}
