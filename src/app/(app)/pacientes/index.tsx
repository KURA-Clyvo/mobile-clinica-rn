import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';
import { usePets } from '@hooks/usePets';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
import { PetListItem } from '@components/domain/PetListItem';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCButton } from '@components/primitives/KCButton';
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
      borderColor: colors.border,
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
      color: colors.textMute,
    },
    separator: {
      height: 1,
      backgroundColor: colors.border,
    },
    emptyContainer: {
      alignItems: 'center',
      paddingTop: 60,
      gap: 12,
    },
    emptyText: {
      fontFamily: 'Lexend_400Regular',
      fontSize: 15,
      color: colors.textMute,
    },
    fabContainer: {
      position: 'absolute',
      bottom: 24,
      right: 24,
    },
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

  const { data: pets = [], isLoading, refetch } = usePets(filtro || undefined);

  const handleSearchChange = useCallback((text: string) => {
    setRawSearch(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFiltro(text.trim());
    }, 300);
  }, []);

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
      <View style={styles.emptyContainer}>
        <KCIcon name="patients" size={48} color={colors.textMute} />
        <Text style={styles.emptyText}>
          {filtro ? STRINGS.PACIENTES.EMPTY_SEARCH : STRINGS.PACIENTES.EMPTY_LIST}
        </Text>
      </View>
    ),
    [colors.textMute, filtro, styles.emptyContainer, styles.emptyText],
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
    //
    // Caveat aceito e não corrigido nesta task: o FAB (`fabContainer`, mais
    // abaixo) usa `position:'absolute', right:24` — isso ancora relativo à
    // caixa de padding do container pai. Antes desta migração o pai era a
    // largura cheia do dispositivo; agora, em telas ≥1200px, o FAB fica
    // ancorado à borda direita da coluna de conteúdo centralizada (~1200px),
    // não à borda física da tela. Julgamento: no smartphone/tablet (onde o
    // FAB é usado de verdade) o comportamento é idêntico ao de hoje; em
    // desktop largo, o FAB alinhado à borda da coluna de conteúdo é
    // consistente com o resto da tela (nada mais nela toca a borda física
    // da tela nesse breakpoint) — não uma regressão visível, mas vale
    // registrar porque não foi medido visualmente, só por estilo declarado.
    <ScreenContainer scroll={false} paddingHorizontal={0}>
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <KCIcon name="search" size={18} color={colors.textMute} />
          <TextInput
            style={styles.searchInput}
            placeholder={STRINGS.PACIENTES.SEARCH_PLACEHOLDER}
            placeholderTextColor={colors.textMute}
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
              <KCIcon name="close" size={16} color={colors.textMute} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countText}>{countLabel}</Text>
      </View>

      <FlatList
        data={pets}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={renderSeparator}
        ListEmptyComponent={renderEmpty}
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
        contentContainerStyle={pets.length === 0 ? undefined : styles.listContent}
      />

      <View style={styles.fabContainer}>
        {/* TASK-83: não existe fluxo de cadastro de paciente nesta tela — o endpoint
            `POST /api/v1/pets` existe no .NET, mas construir a UI (formulário, seleção
            de tutor, validação) é funcionalidade nova fora do escopo deste fix (D1 do
            FIX_7, CRUD incompleto do app da clínica). Por isso o botão não finge uma
            ação: segue o mesmo padrão já usado em "Convidar membro"
            (`settings.tsx`) — permanece tocável e explica a indisponibilidade em vez
            de falhar em silêncio. */}
        <KCButton
          variant="primary"
          size="md"
          onPress={() =>
            Alert.alert(
              'Cadastro de paciente',
              'Funcionalidade em breve — ainda não é possível cadastrar um novo paciente por aqui.',
            )
          }
          accessibilityLabel="Novo paciente — funcionalidade em breve"
          testID="btn-novo-paciente"
        >
          + Novo
        </KCButton>
      </View>
    </ScreenContainer>
  );
}
