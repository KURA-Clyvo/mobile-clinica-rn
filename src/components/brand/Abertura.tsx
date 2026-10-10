import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SplashScreen } from 'expo-router';
import { useTheme } from '@theme/index';
import { KuraMark } from './KuraMark';
import { resolverSimbolo } from './simboloCores';

/**
 * Abertura do app (BR-CLI-T04, canvas `Main`). Duas camadas: o splash NATIVO (só o
 * símbolo sobre `bg`, sem texto — `assets/splash-icon*.png`, gerado por
 * `scripts/gerar-assets.mjs`) e esta abertura em JS, cujo primeiro quadro é IDÊNTICO
 * ao splash: mesma cor de fundo, mesmo símbolo no centro, 100x120 dp
 * (`imageWidth: 200` no `app.json` sobre um quadro de 1024 com o símbolo a 512).
 *
 * Regras (canvas + PLANO_BRANDING §2b): as 3 patas acendem em âmbar, uma depois da
 * outra; no máximo 600 ms; nenhum texto, porcentagem ou dica; some quando a sessão
 * resolve (quem a monta a desmonta — ela nunca espera a animação terminar); com
 * Reduce Motion, só um fade de opacidade de 150 ms, sem patas acendendo.
 * Dentro do app o carregamento é skeleton; esta abertura roda só no arranque.
 *
 * DIVERGÊNCIA DECLARADA do canvas `Main`/§2b (M4 do G2): o símbolo NÃO se desloca até o lugar
 * que ocupa na primeira tela. A primeira tela é o login, cujo símbolo tem outro tamanho e lugar;
 * deslocá-lo exigiria medir o layout em tempo de execução. Aqui a abertura só some.
 */

/** Linha do tempo da abertura, em ms desde o primeiro quadro (canvas `Main`). */
export const PLANO_ABERTURA = {
  /** Pata do meio acende. */
  pataCentralMs: 120,
  /** Patas laterais acendem. */
  pataLateraisMs: 280,
  /** As patas voltam à cor do símbolo. */
  voltaMs: 450,
  /** Teto duro da animação: nenhum passo agenda além disto. */
  fimMs: 600,
  /** Reduce Motion: fade de opacidade, única propriedade animada. */
  fadeReduzidoMs: 150,
} as const;

/** Tamanho do símbolo = o do splash nativo (ver cabeçalho). */
const TAMANHO_SIMBOLO = 100;

type Etapa = 0 | 1 | 2 | 3;

export function Abertura() {
  const { colors } = useTheme();
  const reduzir = useReducedMotion();
  const [etapa, setEtapa] = useState<Etapa>(0);
  const opacidade = useRef(new Animated.Value(reduzir ? 0 : 1)).current;
  const splashEscondido = useRef(false);

  const esconderSplash = useCallback(() => {
    if (splashEscondido.current) return;
    splashEscondido.current = true;
    // Falha ao esconder o splash nunca pode derrubar a abertura.
    Promise.resolve(SplashScreen.hideAsync()).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (reduzir) {
      // Só opacidade. O splash nativo (mesmo quadro) segue cobrindo até o fade acabar — ou até
      // a abertura ser desmontada (o callback também roda no `stop()` do cleanup; esconder o
      // splash nesse caso é o desejado: a tela seguinte já está pronta).
      const fade = Animated.timing(opacidade, {
        toValue: 1,
        duration: PLANO_ABERTURA.fadeReduzidoMs,
        useNativeDriver: true,
      });
      fade.start(esconderSplash);
      return () => fade.stop();
    }
    const t = [
      setTimeout(() => setEtapa(1), PLANO_ABERTURA.pataCentralMs),
      setTimeout(() => setEtapa(2), PLANO_ABERTURA.pataLateraisMs),
      setTimeout(() => setEtapa(3), PLANO_ABERTURA.voltaMs),
    ];
    return () => t.forEach(clearTimeout);
  }, [reduzir, opacidade, esconderSplash]);

  // Cores do símbolo: as mesmas do splash gerado (simboloCores.json), nos dois temas. A pata
  // acesa é `amberInk` (DS: tinta de ícone/texto; `amber` puro dá 2,5:1 sobre o corpo claro).
  const { patas: base, pataAcesa: acesa } = resolverSimbolo('sobreNeutro', colors);
  const patas: [string, string, string] = [
    etapa === 1 || etapa === 2 ? acesa : base,
    etapa === 2 ? acesa : base,
    etapa === 2 ? acesa : base,
  ];

  return (
    <View
      style={[styles.raiz, { backgroundColor: colors.bg }]}
      onLayout={reduzir ? undefined : esconderSplash}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="abertura"
    >
      <Animated.View style={{ opacity: opacidade }}>
        <KuraMark size={TAMANHO_SIMBOLO} variante="sobreNeutro" patas={patas} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
