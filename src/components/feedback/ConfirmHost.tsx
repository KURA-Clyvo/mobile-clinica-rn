import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@theme/index';
import { breakpoints, fonts, fontSize, lightColors, radius, spacing } from '@theme/tokens';
import { typography } from '@theme/typography';
import { KCButton } from '@components/primitives/KCButton';
import { registrarHost, type PedidoFeedback } from './confirmar';

// Host único de confirmar()/avisar(). Celular: bottom sheet; largura >= md: diálogo centrado
// (canvas ClinicaConfirmar). Pedidos simultâneos entram em fila.
const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    // Escurecimento do fundo — mesmo valor dos demais modais do app.
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    scrimSheet: { justifyContent: 'flex-end' },
    scrimCentro: { justifyContent: 'center', alignItems: 'center', padding: spacing[4] },
    caixa: {
      backgroundColor: colors.bgElev,
      padding: spacing[5],
      gap: spacing[2],
      borderWidth: 1,
      borderColor: colors.border,
    },
    caixaSheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
    caixaCentro: { borderRadius: radius.lg, width: '100%', maxWidth: 420 },
    titulo: { fontFamily: fonts.bodyMedium, fontSize: fontSize.md, color: colors.text },
    mensagem: { ...typography.body, color: colors.textSoft },
    acoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[3], flexWrap: 'wrap' },
    botao: { minWidth: 96 },
  });

export function ConfirmHost() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { width } = useWindowDimensions();
  const [atual, setAtual] = useState<PedidoFeedback | null>(null);
  const fila = useRef<PedidoFeedback[]>([]);
  const atualRef = useRef<PedidoFeedback | null>(null);

  const proximo = useCallback(() => {
    const n = fila.current.shift() ?? null;
    atualRef.current = n;
    setAtual(n);
  }, []);

  useEffect(
    () =>
      registrarHost((p) => {
        if (atualRef.current) fila.current.push(p);
        else {
          atualRef.current = p;
          setAtual(p);
        }
      }),
    [],
  );

  const fechar = useCallback(
    (resultado: boolean, escolhido: string | null = null) => {
      const p = atualRef.current;
      if (!p) return;
      if (p.tipo === 'confirmar') p.resolver(resultado);
      else if (p.tipo === 'escolher') p.resolver(escolhido);
      else p.resolver();
      proximo();
    },
    [proximo],
  );

  // Esc: no web o próprio `Modal` do react-native-web já escuta Esc e chama `onRequestClose`
  // (ModalContent.js:26-35); no Android é o botão voltar. Um listener próprio fecharia 2 pedidos
  // da fila com um único Esc (G2 BR-CLI-T02, M-4).

  if (!atual) return null;
  const centro = width >= breakpoints.md;
  const ehConfirmar = atual.tipo === 'confirmar';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => fechar(false)}>
      <View style={[styles.scrim, centro ? styles.scrimCentro : styles.scrimSheet]}>
        {/* Toque fora cancela (avisar também fecha). Deliberadamente um View com responder, NÃO um
            Pressable: o Pressable do RNW vira elemento focável (tabIndex 0) e o focus-trap do Modal
            dá o foco inicial ao 1º descendente focável — o scrim, sem nome (G2 BR-CLI-T02, M-3).
            Num div sem tabindex `focus()` não faz nada e o foco cai no Cancelar. */}
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => fechar(false)}
          accessible={false}
          importantForAccessibility="no"
          testID="confirm-scrim"
        />
        <View
          style={[styles.caixa, centro ? styles.caixaCentro : styles.caixaSheet]}
          accessibilityRole={'alertdialog' as never}
          accessibilityViewIsModal
          testID="confirm-dialog"
        >
          <Text style={styles.titulo} accessibilityRole="header">
            {atual.titulo}
          </Text>
          {atual.mensagem ? <Text style={styles.mensagem}>{atual.mensagem}</Text> : null}
          <View style={styles.acoes}>
            {atual.tipo === 'escolher' ? (
              <>
                {atual.opcoes.map((op) => (
                  <KCButton
                    key={op.id}
                    style={styles.botao}
                    onPress={() => fechar(true, op.id)}
                    testID={`confirm-opcao-${op.id}`}
                  >
                    {op.rotulo}
                  </KCButton>
                ))}
                <KCButton
                  variant="secondary"
                  style={styles.botao}
                  onPress={() => fechar(false)}
                  testID="confirm-cancelar"
                >
                  Cancelar
                </KCButton>
              </>
            ) : ehConfirmar ? (
              <>
                <KCButton
                  variant="secondary"
                  style={styles.botao}
                  onPress={() => fechar(false)}
                  testID="confirm-cancelar"
                >
                  {atual.rotuloCancelar ?? 'Cancelar'}
                </KCButton>
                <KCButton
                  variant={atual.destrutivo ? 'danger' : 'primary'}
                  style={styles.botao}
                  onPress={() => fechar(true)}
                  testID="confirm-ok"
                >
                  {atual.verbo}
                </KCButton>
              </>
            ) : (
              <KCButton style={styles.botao} onPress={() => fechar(true)} testID="confirm-ok">
                Entendi
              </KCButton>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
