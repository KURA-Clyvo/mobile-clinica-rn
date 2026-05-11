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
import { lightColors } from '@theme/tokens';
import { usePets } from '@hooks/usePets';
import { PetListItem } from '@components/domain/PetListItem';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCButton } from '@components/primitives/KCButton';
import { ScreenContainer } from '@components/primitives/ScreenContainer';
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
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
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
        <KCButton
          variant="primary"
          size="md"
          onPress={() => console.log('Novo paciente — escopo futuro')}
        >
          + Novo
        </KCButton>
      </View>
    </View>
  );
}
