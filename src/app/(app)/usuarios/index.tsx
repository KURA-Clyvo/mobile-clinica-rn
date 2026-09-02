import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { useRequireGestor } from '@hooks/useIsGestor';
import {
  useUsuariosClinica,
  useVeterinariosParaSelecao,
  useDesativarUsuarioClinica,
  useReativarUsuarioClinica,
} from '@hooks/useUsuariosClinica';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCCard } from '@components/primitives/KCCard';
import { KCButton } from '@components/primitives/KCButton';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCEmptyState } from '@components/primitives/KCEmptyState';
import { UsuarioClinicaFormModal } from '@components/domain/UsuarioClinicaFormModal';
import { TrocarSenhaModal } from '@components/domain/TrocarSenhaModal';
import { perfilLabel } from '@utils/perfilUsuario';
import type { UsuarioClinicaResponse, ApiError } from '../../../types/api';

// FM-02 — tela de administração dos usuários da clínica (listar, criar,
// desativar/reativar, papel GESTOR|VETERINARIO). Ponto de entrada:
// settings.tsx, seção "Time" ("Convidar membro" agora navega para cá).
//
// Restrita a GESTOR — SÓ `useRequireGestor()` (não a guarda de FICHA da
// FM-01/`usuario !== null`). Li o aviso no fim de useIsGestor.ts sobre a
// corrida de redirect duplo (dois `useEffect` disparando `router.replace`
// para destinos diferentes quando ficha+papel falham juntos NA MESMA tela):
// não se aplica aqui porque esta tela não assina nada como veterinário —
// é administração, não atendimento clínico. Não combina as duas guardas.
//
// ⚠️ DELETE é DESATIVAÇÃO (soft delete), nunca exclusão — todo texto/label
// abaixo diz "desativar"/"reativar", nunca "excluir"/"apagar".

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
      marginBottom: 16,
    },
    backButton: {
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -10,
    },
    headerTitle: { fontFamily: 'Cormorant_500Medium', fontSize: 24, color: colors.text },
    listGrid: { gap: 10, marginBottom: 24 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    emailText: { fontFamily: 'Lexend_500Medium', fontSize: 14, color: colors.text },
    subText: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute, marginTop: 2 },
    badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 10,
      borderRadius: 8,
    },
    actionText: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.primary },
    actionTextDanger: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.danger },
    fabContainer: { position: 'absolute', bottom: 24, right: 24 },
    skeletonCard: { height: 96, borderRadius: 20, opacity: 0.45 },
  });

function badgeToneParaPapel(papel: UsuarioClinicaResponse['tpPerfil']) {
  return papel === 'GESTOR' ? 'ocean' : 'sage';
}

interface UsuarioRowProps {
  usuario: UsuarioClinicaResponse;
  nomeFicha: string | undefined;
  onEditar: () => void;
  onTrocarSenha: () => void;
  onDesativar: () => void;
  onReativar: () => void;
  desativando: boolean;
  reativando: boolean;
}

function UsuarioRow({
  usuario,
  nomeFicha,
  onEditar,
  onTrocarSenha,
  onDesativar,
  onReativar,
  desativando,
  reativando,
}: UsuarioRowProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <KCCard testID="usuario-item">
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.emailText} testID="usuario-email">
            {usuario.dsEmail}
          </Text>
          <Text style={styles.subText}>
            {nomeFicha ?? 'Sem ficha de veterinário vinculada'}
          </Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <KCChip tone={badgeToneParaPapel(usuario.tpPerfil)}>{perfilLabel(usuario.tpPerfil)}</KCChip>
        <KCChip tone={usuario.stAtiva ? 'sage' : 'mute'} dot>
          {usuario.stAtiva ? 'Ativo' : 'Inativo'}
        </KCChip>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={onEditar} testID="btn-editar-usuario">
          <KCIcon name="edit" size={16} color={colors.primary} />
          <Text style={styles.actionText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={onTrocarSenha} testID="btn-trocar-senha">
          <Text style={styles.actionText}>Trocar senha</Text>
        </TouchableOpacity>
        {usuario.stAtiva ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onDesativar}
            disabled={desativando}
            testID="btn-desativar-usuario"
          >
            <Text style={styles.actionTextDanger}>{desativando ? 'Desativando…' : 'Desativar'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onReativar}
            disabled={reativando}
            testID="btn-reativar-usuario"
          >
            <Text style={styles.actionText}>{reativando ? 'Reativando…' : 'Reativar'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </KCCard>
  );
}

export default function UsuariosClinicaScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const podeVer = useRequireGestor();

  const { data: usuarios, isLoading, refetch } = useUsuariosClinica();
  const { data: veterinarios = [] } = useVeterinariosParaSelecao();
  const { mutate: desativar, isPending: desativandoMutation } = useDesativarUsuarioClinica();
  const { mutate: reativar, isPending: reativandoMutation } = useReativarUsuarioClinica();

  const [formVisible, setFormVisible] = useState(false);
  const [editando, setEditando] = useState<UsuarioClinicaResponse | null>(null);
  const [senhaVisible, setSenhaVisible] = useState(false);
  const [senhaAlvo, setSenhaAlvo] = useState<UsuarioClinicaResponse | null>(null);
  // Rastreia qual linha está em mutação, pra não desabilitar a lista inteira
  // enquanto só uma ação está em voo.
  const [idEmAcao, setIdEmAcao] = useState<number | null>(null);

  // Regra dos hooks: TODOS os hooks acima, incondicionais, ANTES do guard de
  // render abaixo — mesmo padrão de consulta/[idPet].tsx e
  // useIsGestor.ts::useRequireGestor (comentário de uso pretendido).
  if (!podeVer) return null;

  const nomeFichaPorVeterinarioId = new Map(veterinarios.map((v) => [v.id, v.nmVeterinario]));

  const abrirCriar = () => {
    setEditando(null);
    setFormVisible(true);
  };

  const abrirEditar = (usuario: UsuarioClinicaResponse) => {
    setEditando(usuario);
    setFormVisible(true);
  };

  const abrirTrocarSenha = (usuario: UsuarioClinicaResponse) => {
    setSenhaAlvo(usuario);
    setSenhaVisible(true);
  };

  const handleErro = (err: unknown) => {
    const e = err as ApiError;
    Alert.alert('Não foi possível concluir', e?.message ?? 'Tente novamente.');
  };

  const confirmarDesativar = (usuario: UsuarioClinicaResponse) => {
    Alert.alert(
      'Desativar usuário?',
      `${usuario.dsEmail} não poderá mais entrar no sistema até ser reativado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: () => {
            setIdEmAcao(usuario.id);
            desativar(usuario.id, {
              onError: handleErro,
              onSettled: () => setIdEmAcao(null),
            });
          },
        },
      ],
    );
  };

  const handleReativar = (usuario: UsuarioClinicaResponse) => {
    setIdEmAcao(usuario.id);
    reativar(usuario.id, {
      onError: handleErro,
      onSettled: () => setIdEmAcao(null),
    });
  };

  return (
    <ScreenContainer
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
      }
    >
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          testID="btn-voltar-usuarios"
          accessibilityLabel="Voltar"
        >
          <KCIcon name="back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Usuários da clínica</Text>
      </View>

      {isLoading ? (
        <View style={styles.listGrid} testID="usuarios-skeleton">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              testID="skeleton"
              style={[styles.skeletonCard, { backgroundColor: colors.border }]}
            />
          ))}
        </View>
      ) : usuarios == null || usuarios.length === 0 ? (
        <KCEmptyState
          icon="patients"
          title="Nenhum usuário encontrado"
          description="Cadastre o primeiro usuário da clínica."
          testID="empty-usuarios"
        />
      ) : (
        <View style={styles.listGrid} testID="usuarios-lista">
          {usuarios.map((usuario) => (
            <UsuarioRow
              key={usuario.id}
              usuario={usuario}
              nomeFicha={
                usuario.idVeterinario != null
                  ? nomeFichaPorVeterinarioId.get(usuario.idVeterinario)
                  : undefined
              }
              onEditar={() => abrirEditar(usuario)}
              onTrocarSenha={() => abrirTrocarSenha(usuario)}
              onDesativar={() => confirmarDesativar(usuario)}
              onReativar={() => handleReativar(usuario)}
              desativando={idEmAcao === usuario.id && desativandoMutation}
              reativando={idEmAcao === usuario.id && reativandoMutation}
            />
          ))}
        </View>
      )}

      <View style={styles.fabContainer}>
        <KCButton variant="primary" size="md" onPress={abrirCriar} testID="btn-novo-usuario">
          + Novo
        </KCButton>
      </View>

      {/* onClose só fecha o modal -- não precisa refetch manual aqui: as
          mutações de criar/atualizar (useCriarUsuarioClinica/
          useAtualizarUsuarioClinica) já invalidam ['usuarios-clinica'] no
          onSuccess, e onClose só é chamado de dentro do modal QUANDO a
          mutação teve sucesso (ver UsuarioClinicaFormModal::onSubmit). */}
      <UsuarioClinicaFormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        usuario={editando}
        veterinarios={veterinarios}
      />

      <TrocarSenhaModal
        visible={senhaVisible}
        onClose={() => setSenhaVisible(false)}
        usuarioId={senhaAlvo?.id ?? null}
        dsEmail={senhaAlvo?.dsEmail ?? ''}
      />
    </ScreenContainer>
  );
}
