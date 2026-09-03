import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { useRequireGestor } from '@hooks/useIsGestor';
import {
  useServicosPreco,
  useDesativarServicoPreco,
  useReativarServicoPreco,
} from '@hooks/useServicosPreco';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { KCCard } from '@components/primitives/KCCard';
import { KCButton } from '@components/primitives/KCButton';
import { KCChip } from '@components/primitives/KCChip';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCEmptyState } from '@components/primitives/KCEmptyState';
import { ServicoPrecoFormModal } from '@components/domain/ServicoPrecoFormModal';
import { formatarMoeda } from '@utils/moeda';
import type { ServicoPrecoResponse, ApiError } from '../../../types/api';

// FM-05 — tela de administração da tabela de preços da clínica
// (SERVICO_PRECO), consumindo ServicosPrecoController do .NET. Restrita a
// GESTOR (useRequireGestor, mesmo padrão de usuarios/index.tsx — FM-02).
// Ponto de entrada: settings.tsx, seção "Financeiro".
//
// 🔴 A lista NASCE só com ativos (default do backend,
// ServicoPrecoRepository.cs:24-30) — mostrar desativados é ato DELIBERADO
// do gestor, via o toggle abaixo. Sem o toggle, a UI mostraria um estado
// (chip "Inativo"/botão "Reativar") que o backend real NUNCA produziria na
// chamada default — foi exatamente o defeito que a FM-02 tinha (ver
// usuarios-clinica.mock.ts, ancoragem).
//
// ⚠️ Linha INATIVA: "Editar" NÃO aparece — o backend RECUSA com 422
// (GarantirServicoAtivo, ServicoPrecoService.cs:122,187-190). Some em vez
// de aparecer desabilitado (doutrina de useIsGestor.ts, item indisponível
// SOME). Não vira beco sem saída: a linha inativa oferece "Reativar", que
// é o próximo passo que o backend manda dar.
//
// ⚠️ DELETE é DESATIVAÇÃO (soft delete), nunca exclusão — todo
// texto/label abaixo diz "desativar"/"reativar", nunca "excluir"/"apagar".

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
      marginBottom: 4,
    },
    backButton: {
      minHeight: 44,
      minWidth: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -10,
    },
    headerTitle: { fontFamily: 'Cormorant_500Medium', fontSize: 24, color: colors.text },
    filterRow: { flexDirection: 'row', marginBottom: 16 },
    listGrid: { gap: 10, marginBottom: 24 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    nomeText: { fontFamily: 'Lexend_500Medium', fontSize: 14, color: colors.text },
    precoText: { fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute, marginTop: 2 },
    badgeRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
    actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    fabContainer: { position: 'absolute', bottom: 24, right: 24 },
    skeletonCard: { height: 96, borderRadius: 20, opacity: 0.45 },
  });

interface ServicoPrecoRowProps {
  servico: ServicoPrecoResponse;
  onEditar: () => void;
  onDesativar: () => void;
  onReativar: () => void;
  desativando: boolean;
  reativando: boolean;
}

function ServicoPrecoRow({
  servico,
  onEditar,
  onDesativar,
  onReativar,
  desativando,
  reativando,
}: ServicoPrecoRowProps) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <KCCard testID="servico-item">
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.nomeText} testID="servico-nome">
            {servico.nmServico}
          </Text>
          <Text style={styles.precoText} testID="servico-preco">
            {formatarMoeda(servico.vlPreco)}
          </Text>
        </View>
      </View>

      <View style={styles.badgeRow}>
        <KCChip tone={servico.stAtiva ? 'sage' : 'mute'} dot>
          {servico.stAtiva ? 'Ativo' : 'Inativo'}
        </KCChip>
      </View>

      <View style={styles.actionsRow}>
        {servico.stAtiva && (
          <KCButton
            variant="secondary"
            size="sm"
            onPress={onEditar}
            testID="btn-editar-servico"
          >
            Editar
          </KCButton>
        )}
        {servico.stAtiva ? (
          <KCButton
            variant="danger"
            size="sm"
            onPress={onDesativar}
            disabled={desativando}
            testID="btn-desativar-servico"
          >
            {desativando ? 'Desativando…' : 'Desativar'}
          </KCButton>
        ) : (
          <KCButton
            variant="secondary"
            size="sm"
            onPress={onReativar}
            disabled={reativando}
            testID="btn-reativar-servico"
          >
            {reativando ? 'Reativando…' : 'Reativar'}
          </KCButton>
        )}
      </View>
    </KCCard>
  );
}

export default function ServicosPrecoScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();
  const podeVer = useRequireGestor();

  const [mostrarInativos, setMostrarInativos] = useState(false);
  const { data: servicos, isLoading, refetch } = useServicosPreco(mostrarInativos);
  const { mutate: desativar, isPending: desativandoMutation } = useDesativarServicoPreco();
  const { mutate: reativar, isPending: reativandoMutation } = useReativarServicoPreco();

  const [formVisible, setFormVisible] = useState(false);
  const [editando, setEditando] = useState<ServicoPrecoResponse | null>(null);
  // Rastreia qual linha está em mutação, pra não desabilitar a lista
  // inteira enquanto só uma ação está em voo (mesmo padrão de
  // usuarios/index.tsx).
  const [idEmAcao, setIdEmAcao] = useState<number | null>(null);

  // Regra dos hooks: todos incondicionais, ANTES do guard de render abaixo
  // — mesmo padrão de usuarios/index.tsx.
  if (!podeVer) return null;

  const abrirCriar = () => {
    setEditando(null);
    setFormVisible(true);
  };

  const abrirEditar = (servico: ServicoPrecoResponse) => {
    setEditando(servico);
    setFormVisible(true);
  };

  const handleErro = (err: unknown) => {
    const e = err as ApiError;
    Alert.alert('Não foi possível concluir', e?.message ?? 'Tente novamente.');
  };

  const confirmarDesativar = (servico: ServicoPrecoResponse) => {
    Alert.alert(
      'Desativar serviço?',
      `"${servico.nmServico}" deixará de aparecer na tabela de preços até ser reativado.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: () => {
            setIdEmAcao(servico.id);
            desativar(servico.id, {
              onError: handleErro,
              onSettled: () => setIdEmAcao(null),
            });
          },
        },
      ],
    );
  };

  const handleReativar = (servico: ServicoPrecoResponse) => {
    setIdEmAcao(servico.id);
    reativar(servico.id, {
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
          testID="btn-voltar-servicos"
          accessibilityLabel="Voltar"
        >
          <KCIcon name="back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tabela de preços</Text>
      </View>

      {/* Toggle "Mostrar desativados" -- KCChip (não TouchableOpacity cru):
          já carrega a própria geometria/interatividade no registry de
          alvo de toque, sem exigir entrada nova aqui. */}
      <View style={styles.filterRow}>
        <KCChip
          tone={mostrarInativos ? 'ocean' : 'mute'}
          onPress={() => setMostrarInativos((v) => !v)}
          testID="toggle-mostrar-desativados"
        >
          {mostrarInativos ? 'Mostrando desativados' : 'Mostrar desativados'}
        </KCChip>
      </View>

      {isLoading ? (
        <View style={styles.listGrid} testID="servicos-preco-skeleton">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              testID="skeleton"
              style={[styles.skeletonCard, { backgroundColor: colors.border }]}
            />
          ))}
        </View>
      ) : servicos == null || servicos.length === 0 ? (
        <KCEmptyState
          icon="dashboard"
          title="Nenhum serviço cadastrado"
          description="Cadastre o primeiro item da tabela de preços."
          testID="empty-servicos-preco"
        />
      ) : (
        <View style={styles.listGrid} testID="servicos-preco-lista">
          {servicos.map((servico) => (
            <ServicoPrecoRow
              key={servico.id}
              servico={servico}
              onEditar={() => abrirEditar(servico)}
              onDesativar={() => confirmarDesativar(servico)}
              onReativar={() => handleReativar(servico)}
              desativando={idEmAcao === servico.id && desativandoMutation}
              reativando={idEmAcao === servico.id && reativandoMutation}
            />
          ))}
        </View>
      )}

      <View style={styles.fabContainer}>
        <KCButton variant="primary" size="md" onPress={abrirCriar} testID="btn-novo-servico">
          + Novo
        </KCButton>
      </View>

      {/* onClose só fecha o modal -- as mutações de criar/atualizar já
          invalidam ['servicos-preco'] no onSuccess (mesmo padrão de
          usuarios/index.tsx). */}
      <ServicoPrecoFormModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        servico={editando}
      />
    </ScreenContainer>
  );
}
