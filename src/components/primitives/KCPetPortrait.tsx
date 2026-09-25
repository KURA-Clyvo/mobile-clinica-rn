import React, { useEffect, useState } from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@theme/index';
import { derivarCacheKeyFoto } from '@utils/fotoCache';

export type PetPalette = 'lab' | 'siam' | 'border' | 'poodle' | 'persa' | 'srd' | 'golden' | 'husky';

export interface KCPetPortraitProps {
  palette: PetPalette;
  size?: number;
  ring?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * FT-08: URL assinada da foto real do pet (`PetResponse.dsFotoUrl`/
   * `dsFotoThumbUrl`, FT-04) — o chamador decide qual variante repassar
   * (lista → thumb 256, detalhe → 1080, regra A5). `null`/`undefined`/vazio
   * caem no ramo de ilustração.
   */
  fotoUrl?: string | null;
  /**
   * FT-08: nome do pet, usado só para compor o `accessibilityLabel` nos 2
   * ramos (com foto e sem foto). Sem `nome`, nenhum `accessibilityLabel` é
   * definido — mantém os snapshots existentes intactos, porque os testes
   * anteriores a esta task não passam essa prop e um prop `undefined` não é
   * serializado pelo react-test-renderer.
   */
  nome?: string;
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

// FT-08: blurhash neutro (cinza uniforme) mostrado pelo expo-image enquanto
// a foto real carrega — não depende de rede nem da paleta da raça (a
// paleta some assim que a foto existe, ela é só o placeholder do ramo sem
// foto).
const BLURHASH_NEUTRO = 'L4L4-;~q00~q00Rj9Fxu00xu%MRj';

export function KCPetPortrait({ palette, size = 88, ring = false, style, fotoUrl, nome }: KCPetPortraitProps) {
  const { colors } = useTheme();
  const { top, base, accent } = PALETTE_MAP[palette];
  const borderRadius = size / 2;
  const accentSize = Math.round(size * 0.3);

  // FT-08: erro no carregamento da imagem (URL expirada, arquivo ausente
  // etc.) volta para a ilustração — sem crash, sem espaço em branco. Reseta
  // quando a URL muda (ex.: troca de pet numa lista com componente
  // reaproveitado) para não prender um pet novo no erro de outro.
  const [erroFoto, setErroFoto] = useState(false);
  useEffect(() => {
    setErroFoto(false);
  }, [fotoUrl]);

  const accessibilityLabel = nome ? `Foto de ${nome}` : undefined;

  const containerStyle = [
    {
      width: size,
      height: size,
      borderRadius,
      overflow: 'hidden' as const,
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
  ];

  // FT-08: com foto (e sem erro de carregamento) → expo-image de verdade.
  if (fotoUrl && !erroFoto) {
    return (
      <View testID="kc-pet-portrait" accessibilityLabel={accessibilityLabel} style={containerStyle}>
        <Image
          testID="kc-pet-portrait-foto"
          // `cacheKey` é campo de `ImageSource` (dentro de `source`), não
          // prop do componente `<Image>` — achado de processo (tsc pegou:
          // "Property 'cacheKey' does not exist on type ... ImageProps").
          source={{ uri: fotoUrl, cacheKey: derivarCacheKeyFoto(fotoUrl) }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={200}
          cachePolicy="disk"
          placeholder={{ blurhash: BLURHASH_NEUTRO }}
          placeholderContentFit="cover"
          onError={() => setErroFoto(true)}
        />
      </View>
    );
  }

  // FT-08: sem foto OU erro no carregamento → ilustração atual, RENDER
  // IDÊNTICO ao de antes desta task (nenhum snapshot existente muda:
  // `accessibilityLabel` só aparece quando `nome` é passado, e os testes
  // anteriores nunca passam essa prop).
  return (
    <View testID="kc-pet-portrait" accessibilityLabel={accessibilityLabel} style={containerStyle}>
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
