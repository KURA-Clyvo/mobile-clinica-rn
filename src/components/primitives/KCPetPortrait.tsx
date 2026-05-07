import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@theme/index';
import { lightColors } from '@theme/tokens';

export type PetPalette = 'lab' | 'siam' | 'border' | 'poodle' | 'persa' | 'srd' | 'golden' | 'husky';

export interface KCPetPortraitProps {
  palette: PetPalette;
  size?: number;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PALETTE_MAP: Record<PetPalette, { top: string; base: string; accent: string }> = {
  lab:    { top: '#F5D79E', base: '#C8972A', accent: '#8B6914' },
  siam:   { top: '#D4C4A8', base: '#6B4226', accent: '#3D1F0A' },
  border: { top: '#F2F2F2', base: '#2C2C2C', accent: '#1A1A1A' },
  poodle: { top: '#F9F0E0', base: '#E8C99A', accent: '#B8906A' },
  persa:  { top: '#FAF0F0', base: '#D4A0A0', accent: '#8B4040' },
  srd:    { top: '#E8D5B0', base: '#A07840', accent: '#6B4A20' },
  golden: { top: '#FFE080', base: '#D4860A', accent: '#8B5500' },
  husky:  { top: '#E8E8F0', base: '#4A4A6A', accent: '#2A2A4A' },
};


export function KCPetPortrait({ palette, size = 88, ring = false, style }: KCPetPortraitProps) {
  const { colors } = useTheme();
  const { top, base, accent } = PALETTE_MAP[palette];
  const borderRadius = size / 2;
  const accentSize = Math.round(size * 0.3);

  return (
    <View
      testID="kc-pet-portrait"
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          overflow: 'hidden',
        },
        ring && {
          borderWidth: 2,
          borderColor: colors.bgElev,
          shadowColor: colors.border,
          shadowOpacity: 1,
          shadowRadius: 1,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={[top, base]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: size * 0.15 }}
      >
        <View
          style={{
            width: accentSize,
            height: accentSize,
            borderRadius: accentSize / 2,
            backgroundColor: accent,
            opacity: 0.3,
          }}
        />
      </LinearGradient>
    </View>
  );
}
