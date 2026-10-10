import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors, radius, spacing } from '@theme/tokens';
import { typography } from '@theme/typography';
import { KCButton } from '@components/primitives/KCButton';
import { ErrorState, ROTULO_TENTAR_DE_NOVO } from './ErrorState';
import { Skeleton } from './Skeleton';

// loading | empty | error | content num lugar só (BR-CLI-02). A regra que importa: ERRO NUNCA
// VIRA VAZIO. `isError` sem dado => ErrorState; `isError` COM dado em cache => o conteúdo
// continua visível (sem `opacity`) e uma faixa diz que são dados salvos.
// Assinatura copiada pelo app do tutor (BR-TUT-T03) — não mudar de um lado só.
export type QueryLike<T> = {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => unknown;
};

export interface QueryStateProps<T> {
  query: QueryLike<T>;
  /** Default: array vazio. */
  isEmpty?: (data: T) => boolean;
  /** Default: <Skeleton variant="list" />. */
  skeleton?: React.ReactNode;
  /** Frase de vazio VERDADEIRO (a chamada deu certo e não há nada). */
  empty: React.ReactNode;
  /** Default: "Não foi possível carregar". */
  errorTitle?: string;
  children: (data: T) => React.ReactNode;
}

export const TEXTO_DADOS_SALVOS = 'Mostrando dados salvos';

const vazioPadrao = (d: unknown) => Array.isArray(d) && d.length === 0;

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    faixa: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: spacing[2],
      paddingVertical: spacing[2],
      paddingHorizontal: spacing[3],
      marginBottom: spacing[3],
      borderRadius: radius.md,
      backgroundColor: colors.infoBg,
    },
    faixaTexto: { ...typography.body, color: colors.text, flexShrink: 1 },
  });

export function QueryState<T>({
  query,
  isEmpty = vazioPadrao,
  skeleton,
  empty,
  errorTitle,
  children,
}: QueryStateProps<T>) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data, isLoading, isError, refetch } = query;
  const tentar = () => {
    void refetch();
  };

  if (data === undefined) {
    if (isError) return <ErrorState titulo={errorTitle} onRetry={tentar} />;
    if (isLoading) return <>{skeleton ?? <Skeleton variant="list" />}</>;
    // Sem dado, sem erro e sem carga (query desabilitada): nada a afirmar, nem vazio.
    return <>{skeleton ?? <Skeleton variant="list" />}</>;
  }

  return (
    <>
      {isError ? (
        <View style={styles.faixa} testID="query-state-salvos" accessibilityRole="alert">
          <Text style={styles.faixaTexto}>{TEXTO_DADOS_SALVOS} —</Text>
          <KCButton variant="ghost" size="sm" onPress={tentar} testID="query-state-salvos-retry" accessibilityLabel={ROTULO_TENTAR_DE_NOVO}>
            {ROTULO_TENTAR_DE_NOVO}
          </KCButton>
        </View>
      ) : null}
      {isEmpty(data) ? empty : children(data)}
    </>
  );
}
