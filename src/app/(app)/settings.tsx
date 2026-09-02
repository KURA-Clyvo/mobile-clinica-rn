import React, { useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { useAuthStore } from '@store/authStore';
import { useOnboardingStore } from '@store/onboardingStore';
import { queryClient } from '@services/queryClient';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCCard } from '@components/primitives/KCCard';
import { KCButton } from '@components/primitives/KCButton';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
import { STRINGS } from '@constants/strings';
import { perfilLabel } from '@utils/perfilUsuario';
import { useIsGestor } from '@hooks/useIsGestor';

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    section: { marginHorizontal: 16, marginTop: 12 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    titleText: { fontFamily: 'Lexend_500Medium', fontSize: 15, color: colors.text },
    separator: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
    fieldRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    fieldLabel: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute },
    fieldValue: { fontFamily: 'Lexend_400Regular', fontSize: 14, color: colors.text },
    prefRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
    },
    prefLabel: { fontFamily: 'Lexend_400Regular', fontSize: 14, color: colors.text },
    prefCaption: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute, marginTop: 2 },
    inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
    inviteText: { fontFamily: 'Lexend_400Regular', fontSize: 14, color: colors.primary },
    noteText: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute, marginTop: 4 },
    aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    aboutLabel: { fontFamily: 'Lexend_400Regular', fontSize: 14, color: colors.text },
    aboutValue: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute },
    footer: { paddingHorizontal: 16, paddingVertical: 24 },
    // CQ-13, item 4 — geometria EXPLÍCITA nos DOIS eixos (44×44), diferente
    // de `inviteRow` acima (sem geometria explícita, categoria
    // 'no-explicit-geometry' no registry de alvo de toque): `minWidth` não
    // força a largura visual (o row continua full-width pelo `flexDirection:
    // 'row'` sem `alignSelf`), só garante o piso de toque real.
    reverRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 44,
      minWidth: 44,
      paddingVertical: 6,
    },
    reverText: { fontFamily: 'Lexend_400Regular', fontSize: 14, color: colors.primary },
  });

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const usuario = useAuthStore((s) => s.usuario);
  const email = useAuthStore((s) => s.email);
  const tpPerfil = useAuthStore((s) => s.tpPerfil);
  const clearSession = useAuthStore((s) => s.clearSession);
  const isGestor = useIsGestor();
  const reopenOnboarding = useOnboardingStore((s) => s.reopen);
  const [notifEnabled, setNotifEnabled] = useState(false);

  const handleLogout = async () => {
    await clearSession();
    queryClient.clear();
    router.replace('/login');
  };

  const confirmLogout = () => {
    Alert.alert('Sair?', 'Sua sessão será encerrada.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: handleLogout },
    ]);
  };

  return (
    <ScreenContainer>
      {/* PERFIL */}
      <View style={styles.section}>
        <KCCard>
          <View style={styles.titleRow}>
            <KCIcon name="settings" size={18} color={colors.primary} />
            <Text style={styles.titleText}>Perfil</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Nome</Text>
            {/* FM-01: sem ficha (GESTOR sem vínculo), não há `nmVeterinario`
                para mostrar — mas isso não é motivo pra virar travessão como
                antes: `perfilLabel` mostra o papel, que é sempre conhecido. */}
            <Text style={styles.fieldValue} testID="vet-name">
              {usuario ? usuario.nmVeterinario : perfilLabel(tpPerfil)}
            </Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>CRMV</Text>
            <Text style={styles.fieldValue} testID="vet-crmv">
              {usuario?.nrCRMV ?? '—'}
            </Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>E-mail</Text>
            {/* FM-01: `usuario?.dsEmail` só existe com ficha. `email` (o que
                a pessoa digitou no login) vem do store SEMPRE que há
                sessão — troca de fonte, não perde a garantia de mostrar
                algo real (o travessão só sobra se nem isso existir, o que
                não deveria acontecer pós-login). */}
            <Text style={styles.fieldValue} testID="vet-email">
              {usuario?.dsEmail ?? email ?? '—'}
            </Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Perfil</Text>
            <Text style={styles.fieldValue} testID="vet-perfil">
              {perfilLabel(tpPerfil)}
            </Text>
          </View>
          {usuario?.dsTelefone && (
            <>
              <View style={styles.separator} />
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Telefone</Text>
                <Text style={styles.fieldValue}>{usuario.dsTelefone}</Text>
              </View>
            </>
          )}
          <View style={{ marginTop: 8 }}>
            <KCChip tone="mute">Edição de perfil em breve</KCChip>
          </View>
        </KCCard>
      </View>

      {/* PREFERÊNCIAS */}
      <View style={styles.section}>
        <KCCard>
          <View style={styles.titleRow}>
            <KCIcon name="edit" size={18} color={colors.primary} />
            <Text style={styles.titleText}>Preferências</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.prefRow}>
            <View>
              <Text style={styles.prefLabel}>Modo escuro</Text>
              <Text style={styles.prefCaption}>
                Adapta cores para ambientes com pouca luz
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.bgElev}
              testID="switch-dark-mode"
            />
          </View>
          <View style={styles.separator} />
          <View style={styles.prefRow}>
            <Text style={styles.prefLabel}>Idioma</Text>
            <KCChip tone="mute">PT-BR (padrão)</KCChip>
          </View>
          <View style={styles.separator} />
          <View style={styles.prefRow}>
            <View>
              <Text style={styles.prefLabel}>Notificações push</Text>
              <Text style={styles.prefCaption}>
                Alertas de pacientes e agendamentos
              </Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={setNotifEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.bgElev}
              testID="switch-notif"
            />
          </View>
        </KCCard>
      </View>

      {/* TIME. FM-01 trocou o gate de `usuario` (a FICHA) para `email` (só
          "está logado") como correção PROVISÓRIA — o próprio comentário da
          FM-01 dizia "um helper genérico de render por papel é escopo da
          FM-03". `email` era a pergunta ERRADA aqui: gerenciar o time da
          clínica é literalmente função de GESTOR (papel), não de "estar
          autenticado" — um VETERINARIO puro também tem `email` e não deveria
          ver esta seção. Gate agora é `isGestor` (`useIsGestor`, FM-03,
          pergunta "meu papel me permite VER isto?" — ver o desenho no
          cabeçalho de `useIsGestor.ts`). Comportamento: a seção SOME para
          quem não é GESTOR (recomendação do backlog, `§E27`), não aparece
          desabilitada. */}
      {isGestor && (
        <View style={styles.section}>
          <KCCard>
            <View style={styles.titleRow}>
              <KCIcon name="patients" size={18} color={colors.primary} />
              <Text style={styles.titleText}>Time</Text>
            </View>
            <View style={styles.separator} />
            <Text style={[styles.prefCaption, { marginBottom: 8 }]}>
              Membros da clínica
            </Text>
            <TouchableOpacity
              style={styles.inviteRow}
              onPress={() => Alert.alert('Funcionalidade em breve')}
              testID="btn-convidar"
            >
              <KCIcon name="plus" size={18} color={colors.primary} />
              <Text style={styles.inviteText}>Convidar membro</Text>
            </TouchableOpacity>
            <Text style={styles.noteText}>
              Gerenciamento de equipe disponível na versão web
            </Text>
          </KCCard>
        </View>
      )}

      {/* PRIMEIROS PASSOS — CQ-13, item 4: re-acesso ao checklist de
          ativação dispensado. "Rever" volta a MOSTRAR o card no dashboard,
          mantendo o progresso já conquistado (não reseta passos concluídos —
          ver `useOnboardingStore.reopen`). Posicionado DEPOIS da seção TIME
          de propósito: inserir entre touchables existentes rebindaria em
          silêncio as chaves posicionais do registry de alvo de toque
          (`tests/touchTargetRegistry.tsx`, ver "Limitação" no cabeçalho de
          `discoverInteractiveTouchables.ts`) — aqui a entrada nova só pode
          ficar depois de `btn-convidar` (SettingsScreen#3). */}
      <View style={styles.section}>
        <KCCard>
          <View style={styles.titleRow}>
            <KCIcon name="check" size={18} color={colors.primary} />
            <Text style={styles.titleText}>{STRINGS.ONBOARDING.TITLE}</Text>
          </View>
          <View style={styles.separator} />
          <TouchableOpacity
            style={styles.reverRow}
            onPress={reopenOnboarding}
            testID="btn-rever-onboarding"
            accessibilityRole="button"
          >
            <KCIcon name="agenda" size={18} color={colors.primary} />
            <Text style={styles.reverText}>{STRINGS.ONBOARDING.REVER}</Text>
          </TouchableOpacity>
          <Text style={styles.noteText}>{STRINGS.ONBOARDING.REVER_CAPTION}</Text>
        </KCCard>
      </View>

      {/* SOBRE */}
      <View style={styles.section}>
        <KCCard>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Versão do app</Text>
            <Text style={styles.aboutValue}>1.0.0</Text>
          </View>
          <View style={styles.separator} />
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>Backend</Text>
            <Text style={styles.aboutValue} numberOfLines={1}>
              {process.env.EXPO_PUBLIC_API_BASE_URL}
            </Text>
          </View>
        </KCCard>
      </View>

      {/* RODAPÉ */}
      <View style={styles.footer}>
        <KCButton
          variant="danger"
          size="lg"
          onPress={confirmLogout}
          testID="btn-sair"
        >
          Sair da conta
        </KCButton>
      </View>
    </ScreenContainer>
  );
}
