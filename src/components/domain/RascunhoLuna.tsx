import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@theme/index';
import { KCIcon } from '@components/primitives/KCIcon';

// BR-CLI-T08 — o que faz um texto da IA parecer rascunho (CFMV 1.465/2022: a IA não salva
// prontuário sem o veterinário confirmar). Canvas `ClinicaSOAP`: selo por campo (`infoBg` +
// ícone `luna`) e faixa "ainda não está no prontuário" (`amberPale`). Texto sempre `text`
// (>= 4.5 nos 2 temas, medido por tests/contrasteRender.test.tsx).

export const SELO_TEXTO = 'Rascunho da Luna — revise e confirme';

export function SeloRascunho({ testID }: { testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.selo, { backgroundColor: colors.infoBg }]} testID={testID}>
      <KCIcon name="luna" size={14} color={colors.info} />
      <Text style={[styles.seloTexto, { color: colors.text }]}>{SELO_TEXTO}</Text>
    </View>
  );
}

export function BannerRascunho({ testID }: { testID?: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: colors.amberPale }]} testID={testID}>
      <KCIcon name="luna" size={20} color={colors.amberInk} />
      <Text style={[styles.bannerTexto, { color: colors.text }]}>
        <Text style={styles.negrito}>Rascunho da Luna.</Text> Ainda não está no prontuário. Nada é
        salvo sem a sua confirmação.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  selo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  seloTexto: { fontFamily: 'Lexend_500Medium', fontSize: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  bannerTexto: { flex: 1, fontFamily: 'Lexend_400Regular', fontSize: 14 },
  negrito: { fontFamily: 'Lexend_500Medium' },
});
