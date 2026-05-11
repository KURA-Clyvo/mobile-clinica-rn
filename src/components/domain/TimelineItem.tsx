import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTheme } from '@theme/index';
import { KCIcon } from '@components/primitives/KCIcon';
import { formatDateShort } from '@utils/date';
import type { TimelineEventResponse } from '../../types/api';
import type { lightColors } from '@theme/tokens';

export interface TimelineItemProps {
  evento: TimelineEventResponse;
  isLast?: boolean;
}

type TipoConfig = {
  label: string;
  iconName: 'consult' | 'check' | 'rx' | 'alert' | 'tele';
  bgKey: keyof typeof lightColors;
  colorKey: keyof typeof lightColors;
};

const TIPO_CONFIG: Record<TimelineEventResponse['nmTipo'], TipoConfig> = {
  CONSULTA:       { label: 'Consulta',       iconName: 'consult', bgKey: 'primaryPale', colorKey: 'primary' },
  VACINA:         { label: 'Vacinação',       iconName: 'check',   bgKey: 'successBg',  colorKey: 'success' },
  PRESCRICAO:     { label: 'Prescrição',      iconName: 'rx',      bgKey: 'infoBg',     colorKey: 'info' },
  EXAME:          { label: 'Exame',           iconName: 'alert',   bgKey: 'warningBg',  colorKey: 'warning' },
  TELEORIENTACAO: { label: 'Teleorientação',  iconName: 'tele',    bgKey: 'sagePale',   colorKey: 'sage' },
};

export function TimelineItem({ evento, isLast = false }: TimelineItemProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const { label, iconName, bgKey, colorKey } = TIPO_CONFIG[evento.nmTipo];
  const bg = colors[bgKey] as string;
  const color = colors[colorKey] as string;

  return (
    <View style={{ flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 16 }} testID={`timeline-item-${evento.idEventoClinico}`}>
      <View style={{ width: 40, alignItems: 'center' }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
          <KCIcon name={iconName} size={18} color={color} />
        </View>
        {!isLast && (
          <View testID="timeline-line" style={{ width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 }} />
        )}
      </View>
      <View style={{ flex: 1, marginLeft: 12, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontFamily: 'Lexend_500Medium', fontSize: 15, color: colors.text }}>{label}</Text>
          <Text style={{ fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute }}>
            {formatDateShort(evento.dtEvento)}
          </Text>
        </View>
        <Text
          style={{ fontFamily: 'Lexend_400Regular', fontSize: 13, color: colors.textSoft }}
          numberOfLines={expanded ? undefined : 2}
          testID="observacao-text"
        >
          {evento.dsObservacao}
        </Text>
        <TouchableOpacity onPress={() => setExpanded((v) => !v)} testID="expand-toggle">
          <Text style={{ fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.primary, marginTop: 2 }}>
            {expanded ? 'Ver menos' : 'Ver mais'}
          </Text>
        </TouchableOpacity>
        {evento.nmVeterinario ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }} testID="vet-row">
            <KCIcon name="consult" size={12} color={colors.textMute} />
            <Text style={{ fontFamily: 'Lexend_400Regular', fontSize: 12, color: colors.textMute }}>
              {evento.nmVeterinario}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
