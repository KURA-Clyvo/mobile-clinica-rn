import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCIcon, type KCIconName } from '@components/primitives/KCIcon';

// Retorno não-decisório ("Serviço desativado", "Senha alterada"). Substitui o `Alert.alert` de
// sucesso, que no web era no-op. Canal por módulo (como `confirmar`) para qualquer tela chamar
// sem depender de Provider montado; o `ToastProvider` só desenha.
export type TipoToast = 'sucesso' | 'erro' | 'info';
export type OpcoesToast = { tipo: TipoToast; texto: string };

const DURACAO_MS = 4000;
// Token de motion `d-base` do DS (220ms): botão e toast entrando.
const D_BASE_MS = 220;

type Ouvinte = (t: OpcoesToast) => void;
let ouvinte: Ouvinte | null = null;

/** Registra quem desenha o toast (o `ToastProvider`; testes registram um coletor). */
export function registrarOuvinteToast(o: Ouvinte): () => void {
  ouvinte = o;
  return () => {
    if (ouvinte === o) ouvinte = null;
  };
}

export function mostrarToast(o: OpcoesToast): void {
  if (!ouvinte) {
    if (__DEV__) console.warn('toast: nenhum ToastProvider montado:', o.texto);
    return;
  }
  ouvinte(o);
}

export function useToast(): { show(o: OpcoesToast): void } {
  const show = useCallback((o: OpcoesToast) => mostrarToast(o), []);
  return useMemo(() => ({ show }), [show]);
}

const ICONE: Record<TipoToast, KCIconName> = { sucesso: 'check', erro: 'alert', info: 'bell' };

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    faixa: { position: 'absolute', left: 16, right: 16, bottom: 24, alignItems: 'center' },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      maxWidth: 480,
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      borderWidth: 1,
      backgroundColor: colors.bgElev,
    },
    texto: { fontFamily: 'Lexend_400Regular', fontSize: 14, color: colors.text, flexShrink: 1 },
  });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [toast, setToast] = useState<OpcoesToast | null>(null);
  const opacidade = useRef(new Animated.Value(0)).current;
  const reduzir = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const p = AccessibilityInfo.isReduceMotionEnabled?.();
    p?.then((v) => {
      reduzir.current = !!v;
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const desregistrar = registrarOuvinteToast((t) => {
      if (timer.current) clearTimeout(timer.current);
      setToast(t);
      opacidade.setValue(0);
      Animated.timing(opacidade, {
        toValue: 1,
        duration: reduzir.current ? 0 : D_BASE_MS,
        useNativeDriver: true,
      }).start();
      timer.current = setTimeout(() => setToast(null), DURACAO_MS);
    });
    return () => {
      desregistrar();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [opacidade]);

  const cor = toast
    ? toast.tipo === 'sucesso'
      ? colors.success
      : toast.tipo === 'erro'
        ? colors.danger
        : colors.info
    : colors.border;

  return (
    <>
      {children}
      {toast ? (
        <View style={styles.faixa} pointerEvents="none">
          <Animated.View
            style={[styles.toast, { borderColor: cor, opacity: opacidade }]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            testID="toast"
          >
            <KCIcon name={ICONE[toast.tipo]} size={18} color={cor} />
            <Text style={styles.texto}>{toast.texto}</Text>
          </Animated.View>
        </View>
      ) : null}
    </>
  );
}
