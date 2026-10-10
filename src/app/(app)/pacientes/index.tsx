import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors, spacing } from '@theme/tokens';
import { usePets } from '@hooks/usePets';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { PetListItem } from '@components/domain/PetListItem';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCButton } from '@components/primitives/KCButton';
import { KCEmptyState } from '@components/primitives/KCEmptyState';
import { QueryState } from '@components/feedback/QueryState';
import { Skeleton } from '@components/feedback/Skeleton';
import { STRINGS } from '@constants/strings';
import { ROUTES } from '@constants/routes';
import type { PetResponse } from '../../../types/api';

const ITEM_HEIGHT = 76;

const makeStyles = (colors: typeof lightColors) =>
  StyleSheet.create({
    searchWrapper: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: colors.bgElev,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderControl,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 10,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.text,
    },
    countRow: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    countText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 12,
      color: colors.textMuteInk,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
    },
    fabContainer: {
      position: 'absolute',
      bottom: 24,
      right: 24,
      gap: 10,
    },
    estadoPad: { paddingHorizontal: spacing[4] },
    listContent: {
      paddingBottom: 80,
    },
  });

export default function PacientesScreen() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const router = useRouter();

  const [rawSearch, setRawSearch] = useState('');
  const [filtro, setFiltro] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const petsQuery = usePets(filtro || undefined);
  const { isLoading, refetch } = petsQuery;
  const pets = petsQuery.data ?? [];

  const handleSearchChange = useCallback((text: string) => {
    setRawSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFiltro(text.trim());
    }, 300);
  }, []);

  // Contagem só existe com dado: carregando ou com erro NÃO é "0 pacientes" (BR-CLI-02).
  const countLabel =
    pets.length === 1
      ? STRINGS.PACIENTES.COUNT_SINGULAR
      : STRINGS.PACIENTES.COUNT_PLURAL(pets.length);

  const getItemLayout = useCallback(
    (_: ArrayLike<PetResponse> | null | undefined, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [styles.separator],
  );

  const renderEmpty = useCallback(
    () => (
      <KCEmptyState
        icon="patients"
        title={filtro ? STRINGS.PACIENTES.EMPTY_SEARCH : STRINGS.PACIENTES.EMPTY_LIST}
        description={filtro ? STRINGS.PACIENTES.EMPTY_SEARCH_DESC : STRINGS.PACIENTES.EMPTY_LIST_DESC}
        testID={filtro ? 'empty-search' : 'empty-list'}
      />
    ),
    [filtro],
  );

  const renderItem = useCallback(
    ({ item }: { item: PetResponse }) => (
      <PetListItem
        pet={item}
        onPress={() => router.push(ROUTES.app.pacienteDetalhe(item.id))}
      />
    ),
    [router],
  );

  return (
    // CQ-15: scroll={false} — a lista é uma FlatList, que já virtualiza e
    // gerencia seu próprio scroll (`getItemLayout`, `removeClippedSubviews`);
    // aninhar isso num ScrollView (o modo scroll=true padrão) dispararia o
    // aviso "VirtualizedLists should never be nested inside plain
    // ScrollViews" e derrotaria a virtualização. paddingHorizontal={0}
    // porque searchWrapper/countRow já controlam seu próprio respiro.
    // style={{paddingBottom:0}} por consistência com teleorientacao/agenda —
    // cancela o paddingBottom:24 do modo flat, que encolheria a FlatList em
    // 24px (sem efeito visível aqui, mesma cor de fundo).
    //
    // O caveat do FAB (`fabContainer`, ancoragem em relação à coluna
    // centralizada, não à borda física da tela ≥1200px) está documentado
    // como propriedade do primitivo em `ScreenContainer.tsx`, não aqui —
    // o mesmo efeito também se aplica aos rodapés absolutos de
    // `consulta`/`receituario`.
    <ScreenContainer scroll={false} paddingHorizontal={0} style={{ paddingBottom: 0 }}>
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <KCIcon name="search" size={18} color={colors.textMuteInk} />
          <TextInput
            style={styles.searchInput}
            placeholder={STRINGS.PACIENTES.SEARCH_PLACEHOLDER}
            placeholderTextColor={colors.textMuteInk}
            value={rawSearch}
            onChangeText={handleSearchChange}
            testID="search-input"
          />
          {rawSearch.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setRawSearch('');
                setFiltro('');
              }}
            >
              <KCIcon name="close" size={16} color={colors.textMuteInk} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <QueryState
        query={petsQuery}
        skeleton={<Skeleton variant="list" count={6} style={styles.estadoPad} />}
        empty={<View style={styles.estadoPad}>{renderEmpty()}</View>}
        errorTitle="Não foi possível carregar os pacientes"
      >
        {() => (
          <>
            <View style={styles.countRow}>
              <Text style={styles.countText}>{countLabel}</Text>
            </View>

            <FlatList
              data={pets}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderItem}
              ItemSeparatorComponent={renderSeparator}
              getItemLayout={getItemLayout}
              removeClippedSubviews
              maxToRenderPerBatch={12}
              initialNumToRender={15}
              refreshControl={
                <RefreshControl
                  refreshing={isLoading}
                  onRefresh={refetch}
                  tintColor={colors.primary}
                />
              }
              contentContainerStyle={styles.listContent}
            />
          </>
        )}
      </QueryState>

      <View style={styles.fabContainer}>
        {/* REC-03: entrada real de cadastro de tutor — POST /api/v1/tutores
            existe e a UI (formulário + convite) foi construída nesta task.
            Distinta do botão "+ Novo" abaixo (cadastro de PACIENTE/pet, que
            continua sem fluxo real — ver comentário da TASK-83 logo abaixo). */}
        <KCButton
          variant="secondary"
          size="md"
          onPress={() => router.push(ROUTES.app.tutorNovo)}
          accessibilityLabel="Novo tutor"
          testID="btn-novo-tutor"
        >
          Novo tutor
        </KCButton>
        {/* REC-04: fluxo real — "Adicionar pet a partir de um tutor existente"
            (busca de tutor + formulário de pet, `pacientes/novo.tsx`). Substitui o
            Alert "funcionalidade em breve" da TASK-83 (FIX_7) — POST /api/v1/pets
            construído nesta task. */}
        <KCButton
          variant="primary"
          size="md"
          onPress={() => router.push(ROUTES.app.pacienteNovo)}
          accessibilityLabel="Novo paciente"
          testID="btn-novo-paciente"
        >
          + Novo
        </KCButton>
      </View>
    </ScreenContainer>
  );
}
