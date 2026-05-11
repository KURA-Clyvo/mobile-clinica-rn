import React, { useState } from 'react';
import { Alert, ActivityIndicator, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@theme/index';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCChip } from '@components/primitives/KCChip';
import { sugestaoSOAP } from '../../mocks/luna.mock';

export interface LunaSuggestionBadgeProps {
  campo: 'S' | 'O' | 'A' | 'P';
  idPet: number;
  currentText?: string;
  onSugest: (texto: string) => void;
}

export function LunaSuggestionBadge({
  campo,
  idPet,
  currentText,
  onSugest,
}: LunaSuggestionBadgeProps) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);

  const handleSugest = async () => {
    const doSugest = async () => {
      setLoading(true);
      await new Promise<void>((r) => setTimeout(r, 500));
      const texto = sugestaoSOAP(campo, idPet);
      setLoading(false);
      onSugest(texto);
    };

    if (currentText && currentText.trim().length > 0) {
      Alert.alert(
        'Substituir texto atual?',
        'A sugestão da Luna substituirá o texto já digitado.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Substituir', onPress: doSugest },
        ],
      );
    } else {
      await doSugest();
    }
  };

  return (
    <TouchableOpacity
      onPress={handleSugest}
      style={{ alignSelf: 'flex-end', marginBottom: 4 }}
      disabled={loading}
      testID={`luna-badge-${campo}`}
    >
      {loading ? (
        <View style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <KCChip tone="ocean">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <KCIcon name="luna" size={12} color={colors.primary} />
          </View>
          {'Luna: sugerir'}
        </KCChip>
      )}
    </TouchableOpacity>
  );
}
