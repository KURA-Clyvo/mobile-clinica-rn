import React from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { useTheme } from '@theme/index';
import { KCIcon } from '@components/primitives/KCIcon';
import { KCChip } from '@components/primitives/KCChip';

export interface LunaSuggestionBadgeProps {
  campo: 'S' | 'O' | 'A' | 'P';
  /**
   * Rascunho REAL deste campo, vindo da transcrição por áudio
   * (`useEnviarTranscricao` → `EventoClinicoSoapResponse.soap.{s,o,a,p}`,
   * ver `[idPet].tsx`). LU-10 (N4 do backlog): este componente NUNCA busca
   * texto sozinho (nem de mock, nem de rede) — o rascunho chega pronto por
   * prop, ou o badge não existe.
   */
  draftText?: string | null;
  currentText?: string;
  onSugest: (texto: string) => void;
}

export function LunaSuggestionBadge({
  campo,
  draftText,
  currentText,
  onSugest,
}: LunaSuggestionBadgeProps) {
  const { colors } = useTheme();

  // Sem rascunho (transcrição ainda não rodou, ou este campo especificamente
  // veio vazio) → 0 badge. Critério de aceite literal do brief LU-10.
  if (!draftText || draftText.trim().length === 0) {
    return null;
  }

  const aplicarRascunho = () => onSugest(draftText);

  const handleSugest = () => {
    if (currentText && currentText.trim().length > 0) {
      Alert.alert(
        'Substituir texto atual?',
        'A sugestão da Luna substituirá o texto já digitado.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Substituir', onPress: aplicarRascunho },
        ],
      );
    } else {
      aplicarRascunho();
    }
  };

  return (
    <TouchableOpacity
      onPress={handleSugest}
      style={{ alignSelf: 'flex-end', marginBottom: 4 }}
      testID={`luna-badge-${campo}`}
    >
      <KCChip tone="ocean">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <KCIcon name="luna" size={12} color={colors.primary} />
        </View>
        {'Usar rascunho da Luna'}
      </KCChip>
    </TouchableOpacity>
  );
}
