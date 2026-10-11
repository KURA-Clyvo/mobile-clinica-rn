import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@theme/index';
import { fontSize, fonts, lightColors, spacing } from '@theme/tokens';
import { useLunaHealth } from '@hooks/useLuna';
import { KCCard } from '@components/primitives/KCCard';
import { KCIcon } from '@components/primitives/KCIcon';
import { STRINGS } from '@constants/strings';
import { isLunaHealthUp, isServicoUp } from '@utils/lunaHealth';

// C6 (BR-CLI-T07): a telemetria "Oracle DB / API Kura UP|DOWN" saiu da tela da Luna (era
// painel de infraestrutura no meio da fila clinica) e mora aqui, em Configuracoes, so para
// GESTOR (o gate fica no chamador, `isGestor`). Mesmo dado do GET /ready que antes alimentava
// os dois cards.
const SERVICOS = [
  { chave: 'oracle', label: 'Oracle DB' },
  { chave: 'kura_api', label: 'API Kura' },
] as const;

export function LunaDiagnostico() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { data: health, isError } = useLunaHealth();
  const up = !isError && isLunaHealthUp(health);
  return (
    <View style={styles.section} testID="luna-diagnostico">
      <KCCard>
        <View style={styles.titulo}>
          <KCIcon name="luna" size={18} color={colors.primary} />
          <Text style={styles.tituloTexto}>{STRINGS.LUNA.DIAGNOSTICO_TITLE}</Text>
        </View>
        {up ? (
          SERVICOS.map(({ chave, label }) => {
            const ok = isServicoUp(health[chave]);
            return (
              <View key={chave} style={styles.linha}>
                <Text style={styles.label}>{label}</Text>
                <Text
                  style={[styles.estado, { color: ok ? colors.success : colors.danger }]}
                  testID={`svc-${chave}`}
                >
                  {ok ? 'UP' : 'DOWN'}
                </Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.label} testID="luna-diagnostico-offline">
            {STRINGS.LUNA.STATUS_OFFLINE}
          </Text>
        )}
      </KCCard>
    </View>
  );
}

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    section: { paddingHorizontal: spacing[4], marginTop: spacing[3] },
    titulo: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
    tituloTexto: { fontFamily: fonts.bodyMedium, fontSize: fontSize.base, color: colors.text },
    linha: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing[1] },
    label: { fontFamily: fonts.body, fontSize: fontSize.sm, color: colors.textSoft },
    estado: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm },
  });
