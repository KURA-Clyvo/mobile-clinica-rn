import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import type { Href } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { KCCard } from '@components/primitives/KCCard';
import { KCIcon } from '@components/primitives/KCIcon';
import type { KCIconName } from '@components/primitives/KCIcon';
import { ROUTES } from '@constants/routes';
import { STRINGS } from '@constants/strings';
import { useOnboardingStore, type OnboardingStepId } from '@store/onboardingStore';

// CQ-13 (dev VsClaude, KURA_BACKLOG_CLINICA_1) — item 2: checklist de
// ativação, card dispensável no topo do dashboard (decisão do Felipe,
// registrada no brief: NÃO é rota nova, NÃO é modal, NÃO é só-dentro-do-
// estado-vazio). Restrição de marca (inegociável): mascote é VETADO na UI
// clínica — nenhum ícone deste componente usa ilustração de bichinho, só os
// ícones de linha do `KCIcon`.
//
// 4 passos, todos apontando para ROTA ESTÁTICA de `ROUTES.app` — decisão
// registrada no relatório da task: as 4 rotas dinâmicas da lista de 8 do
// brief (`pacientes/[id]`, `consulta/[idPet]`, `receituario/[idPet]`,
// `teleorientacao/[idPet]`) exigem um paciente concreto em contexto, que o
// dashboard não tem — apontar pra lá sem um ID real não seria "rota real e
// funcional" tocável a partir daqui. As 4 estáticas cobrem uma história de
// primeiro uso coerente: agenda (o que vou atender), pacientes (quem eu
// atendo), Luna (a assistente de IA do produto), configurações (ajustar a
// própria conta).
interface OnboardingStepMeta {
  id: OnboardingStepId;
  label: string;
  icon: KCIconName;
  href: Href;
}

const STEPS: OnboardingStepMeta[] = [
  { id: 'agenda', label: STRINGS.ONBOARDING.STEP_AGENDA, icon: 'agenda', href: ROUTES.app.agenda },
  { id: 'pacientes', label: STRINGS.ONBOARDING.STEP_PACIENTES, icon: 'patients', href: ROUTES.app.pacientes },
  { id: 'luna', label: STRINGS.ONBOARDING.STEP_LUNA, icon: 'luna', href: ROUTES.app.luna },
  { id: 'settings', label: STRINGS.ONBOARDING.STEP_SETTINGS, icon: 'settings', href: ROUTES.app.settings },
];

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    card: { marginBottom: 20 },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    headerTextBlock: { flex: 1 },
    title: {
      fontFamily: 'Lexend_500Medium',
      fontSize: 15,
      color: colors.text,
    },
    subtitle: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMute,
      marginTop: 2,
    },
    // Alvo de toque: 44×44 nos DOIS eixos, explícito — `minWidth`/`minHeight`
    // não forçam a área visual (o botão continua do tamanho do ícone), só
    // garantem o piso de toque real (gate `touch-target-coverage`, registry
    // categoria 'meets-min').
    closeBtn: {
      minWidth: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -10,
      marginRight: -10,
      marginLeft: 8,
    },
    stepsList: { marginTop: 14, gap: 2 },
    step: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      minWidth: 44,
      paddingVertical: 6,
    },
    stepIconWrap: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepLabel: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 14,
      color: colors.text,
      flex: 1,
    },
    stepLabelDone: {
      color: colors.textMute,
      textDecorationLine: 'line-through',
    },
  });

export function OnboardingChecklist() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const completedSteps = useOnboardingStore((s) => s.completedSteps);
  const dismissed = useOnboardingStore((s) => s.dismissed);
  const hasHydrated = useOnboardingStore((s) => s._hasHydrated);
  const dismiss = useOnboardingStore((s) => s.dismiss);

  // Não renderiza antes da hidratação (evita o card "piscar" visível e sumir
  // — mesmo raciocínio do `_hasHydrated` de `authStore.ts`, citado
  // explicitamente no brief) nem depois de dispensado.
  if (!hasHydrated || dismissed) return null;

  const remainingCount = STEPS.filter((s) => !completedSteps.includes(s.id)).length;
  const subtitle =
    remainingCount === 0
      ? STRINGS.ONBOARDING.SUBTITLE_DONE
      : STRINGS.ONBOARDING.SUBTITLE_REMAINING(remainingCount, STEPS.length);

  return (
    <KCCard style={styles.card} testID="onboarding-checklist">
      <View style={styles.headerRow}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>{STRINGS.ONBOARDING.TITLE}</Text>
          <Text style={styles.subtitle} testID="onboarding-progress">
            {subtitle}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={dismiss}
          testID="onboarding-dismiss"
          accessibilityRole="button"
          accessibilityLabel={STRINGS.ONBOARDING.CLOSE_A11Y}
        >
          <KCIcon name="close" size={16} color={colors.textMute} />
        </TouchableOpacity>
      </View>

      <View style={styles.stepsList}>
        {STEPS.map((step) => {
          const done = completedSteps.includes(step.id);
          return (
            <Link key={step.id} href={step.href} asChild>
              <TouchableOpacity
                style={styles.step}
                testID={`onboarding-step-${step.id}`}
                accessibilityRole="button"
                accessibilityLabel={step.label}
                accessibilityState={{ checked: done }}
              >
                <View
                  style={[
                    styles.stepIconWrap,
                    { backgroundColor: done ? colors.successBg : colors.primaryPale },
                  ]}
                >
                  <KCIcon
                    name={done ? 'check' : step.icon}
                    size={16}
                    color={done ? colors.success : colors.primary}
                  />
                </View>
                <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{step.label}</Text>
              </TouchableOpacity>
            </Link>
          );
        })}
      </View>
    </KCCard>
  );
}
