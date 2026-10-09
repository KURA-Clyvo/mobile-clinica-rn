import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@theme/index';
import { breakpoints, lightColors } from '@theme/tokens';
import { KCButton } from '@components/primitives/KCButton';
import { registrarHost, type PedidoFeedback } from './confirmar';

// Host único de confirmar()/avisar(). Celular: bottom sheet; largura >= md: diálogo centrado
// (canvas ClinicaConfirmar). Pedidos simultâneos entram em fila.
const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    // Escurecimento do fundo — mesmo valor dos demais modais do app.
    scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
    scrimSheet: { justifyContent: 'flex-end' },
    scrimCentro: { justifyContent: 'center', alignItems: 'center', padding: 16 },
    caixa: {
      backgroundColor: colors.bgElev,
      padding: 20,
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    caixaSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    caixaCentro: { borderRadius: 14, width: '100%', maxWidth: 420 },
    titulo: { fontFamily: 'Lexend_500Medium', fontSize: 17, color: colors.text },
    mensagem: { fontFamily: 'Lexend_400Regular', fontSize: 14, color: colors.textSoft, lineHeight: 20 },
    acoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12, flexWrap: 'wrap' },
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

  // Esc cancela no web.
  useEffect(() => {
    if (!atual || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [atual, fechar]);

  if (!atual) return null;
  const centro = width >= breakpoints.md;
  const ehConfirmar = atual.tipo === 'confirmar';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => fechar(false)}>
      <View style={[styles.scrim, centro ? styles.scrimCentro : styles.scrimSheet]}>
        {/* Toque fora cancela (avisar também fecha). */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => fechar(false)}
          accessible={false}
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
                  Cancelar
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
