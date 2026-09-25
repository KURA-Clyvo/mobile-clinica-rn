import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../src/theme';
import { KCPetPortrait, PetPalette } from '../src/components/primitives/KCPetPortrait';

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

const PALETTES: PetPalette[] = [
  'lab', 'siam', 'border', 'poodle', 'persa', 'srd', 'golden', 'husky',
];

describe('KCPetPortrait', () => {
  describe('palette snapshots', () => {
    PALETTES.forEach((palette) => {
      it(`renders ${palette} palette`, () => {
        const { toJSON } = wrap(<KCPetPortrait palette={palette} />);
        expect(toJSON()).toMatchSnapshot();
      });
    });
  });

  it('renders all 8 palettes without crash', () => {
    PALETTES.forEach((palette) => {
      expect(() => wrap(<KCPetPortrait palette={palette} />)).not.toThrow();
    });
  });

  it('applies size to container dimensions', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="lab" size={64} />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.width).toBe(64);
    expect(flat.height).toBe(64);
  });

  it('uses default size 88 when size not provided', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="golden" />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.width).toBe(88);
    expect(flat.height).toBe(88);
  });

  it('borderRadius equals half of size', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="husky" size={100} />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.borderRadius).toBe(50);
  });

  it('renders ring decorative border when ring=true', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="border" ring />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.borderWidth).toBe(2);
  });

  it('renders without ring when ring=false (default)', () => {
    const { getByTestId } = wrap(<KCPetPortrait palette="lab" />);
    const portrait = getByTestId('kc-pet-portrait');
    const flat = StyleSheet.flatten(portrait.props.style);
    expect(flat.borderWidth).toBeUndefined();
  });

  // FT-08 — ramo com foto real (dsFotoUrl/dsFotoThumbUrl, FT-04). Literais
  // próprios aqui (regra do ciclo: não importar do módulo testado nem do
  // helper de cacheKey para montar o esperado).
  describe('foto real (FT-08)', () => {
    const FOTO_URL =
      'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/2/uuid-fixo_1080.webp?exp=1790000000&sig=deadbeef';
    const CACHE_KEY_ESPERADA =
      'https://kura-clinica.vercel.app/proxy/clinica/api/v1/fotos/clinica/1/pet/2/uuid-fixo_1080.webp';

    it('com fotoUrl, renderiza a imagem real em vez da ilustração', () => {
      const { getByTestId, queryByTestId } = wrap(
        <KCPetPortrait palette="lab" fotoUrl={FOTO_URL} />,
      );
      expect(getByTestId('kc-pet-portrait-foto')).toBeTruthy();
      expect(queryByTestId('LinearGradient')).toBeNull();
    });

    it('sem fotoUrl, mantém a ilustração e não renderiza a imagem', () => {
      const { getByTestId, queryByTestId } = wrap(<KCPetPortrait palette="lab" />);
      expect(getByTestId('LinearGradient')).toBeTruthy();
      expect(queryByTestId('kc-pet-portrait-foto')).toBeNull();
    });

    it('usa a URL completa (com query) como source.uri', () => {
      const { getByTestId } = wrap(<KCPetPortrait palette="lab" fotoUrl={FOTO_URL} />);
      const foto = getByTestId('kc-pet-portrait-foto');
      // expo-image normaliza `source` para array internamente
      // (resolveSources) mesmo recebendo um objeto único.
      expect(foto.props.source).toEqual([{ uri: FOTO_URL, cacheKey: CACHE_KEY_ESPERADA }]);
    });

    it('cacheKey (dentro de source) é a URL SEM a query string — mordida: usar a URL completa faz esta asserção falhar', () => {
      const { getByTestId } = wrap(<KCPetPortrait palette="lab" fotoUrl={FOTO_URL} />);
      const foto = getByTestId('kc-pet-portrait-foto');
      // `cacheKey` é campo de `ImageSource` (dentro de `source`), não prop
      // solta do componente `<Image>` do expo-image.
      const cacheKey = foto.props.source[0].cacheKey;
      expect(cacheKey).toBe(CACHE_KEY_ESPERADA);
      expect(cacheKey).not.toContain('sig=');
      expect(cacheKey).not.toContain('exp=');
    });

    it('usa cachePolicy de disco e contentFit cover', () => {
      const { getByTestId } = wrap(<KCPetPortrait palette="lab" fotoUrl={FOTO_URL} />);
      const foto = getByTestId('kc-pet-portrait-foto');
      expect(foto.props.cachePolicy).toBe('disk');
      expect(foto.props.contentFit).toBe('cover');
    });

    it('onError volta para a ilustração — mordida: remover o fallback faz este teste falhar', () => {
      const { getByTestId, queryByTestId } = wrap(
        <KCPetPortrait palette="lab" fotoUrl={FOTO_URL} />,
      );
      const foto = getByTestId('kc-pet-portrait-foto');
      // Shape de `NativeSyntheticEvent<ImageErrorEventData>`: o wrapper do
      // expo-image (`withDeprecatedNativeEvent`) acessa `event.nativeEvent`
      // diretamente.
      fireEvent(foto, 'error', { nativeEvent: { error: 'falha ao carregar' } } as never);
      expect(queryByTestId('kc-pet-portrait-foto')).toBeNull();
      expect(getByTestId('LinearGradient')).toBeTruthy();
    });

    it('accessibilityLabel com o nome do pet no ramo COM foto', () => {
      const { getByLabelText } = wrap(
        <KCPetPortrait palette="lab" fotoUrl={FOTO_URL} nome="Thor" />,
      );
      expect(getByLabelText('Foto de Thor')).toBeTruthy();
    });

    it('accessibilityLabel com o nome do pet no ramo SEM foto', () => {
      const { getByLabelText } = wrap(<KCPetPortrait palette="lab" nome="Bolinha" />);
      expect(getByLabelText('Foto de Bolinha')).toBeTruthy();
    });

    it('sem nome, nenhum accessibilityLabel é definido (compatibilidade com os snapshots antigos)', () => {
      const { getByTestId } = wrap(<KCPetPortrait palette="lab" />);
      const portrait = getByTestId('kc-pet-portrait');
      expect(portrait.props.accessibilityLabel).toBeUndefined();
    });
  });
});
